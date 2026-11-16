#!/usr/bin/env bash
# Stops what a session started: the emulators, the adb server, the Gradle and
# Kotlin daemons, and the web servers listening on the --port numbers given.
# Then prints what is still running.
set -euo pipefail

usage() {
  cat <<'EOF'
usage: scripts/stop-dev.sh [--port <n>]...

Stops the running emulators, the adb server and the Gradle and Kotlin daemons,
and the process group of each process listening on a --port <n>. Repeat --port
for each web server. Then prints what is still running.

Exit status: 0 when nothing is left running, 1 when something is, 2 on a bad
argument.
EOF
}

ports=()
while (($# > 0)); do
  case "$1" in
    --port)
      if (($# < 2)) || [[ ! "$2" =~ ^[0-9]+$ ]]; then
        echo "stop-dev: --port needs a port number" >&2
        exit 2
      fi
      ports+=("$2")
      shift 2
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      echo "stop-dev: unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
android_home="${ANDROID_HOME:-$HOME/Android/Sdk}"
adb="$android_home/platform-tools/adb"
acted=0
alive=0

# This process and each of its ancestors. They are never signalled, even when
# their command line contains a pattern the script searches for.
protected_pids() {
  local pid=$$
  while [[ -n "$pid" ]] && ((pid > 1)); do
    echo "$pid"
    pid="$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ' || true)"
  done
}

# Prints the pids pgrep matches, minus the protected ones.
find_pids() {
  local protected pid
  protected="$(protected_pids)"
  while read -r pid; do
    if [[ -n "$pid" ]] && ! grep -qx "$pid" <<<"$protected"; then
      echo "$pid"
    fi
  done < <(pgrep "$@" || true)
}

# Waits up to $1 seconds for no process to match the remaining pgrep arguments.
wait_for_none() {
  local seconds="$1" i
  shift
  for ((i = 0; i < seconds * 2; i++)); do
    if [[ -z "$(find_pids "$@")" ]]; then
      return 0
    fi
    sleep 0.5
  done
  return 1
}

# Sends SIGTERM to every process that matches the pgrep arguments.
term_matching() {
  local label="$1" pid
  shift
  while read -r pid; do
    echo "$label: stopping pid $pid"
    kill -TERM "$pid" 2>/dev/null || true
    acted=1
  done < <(find_pids "$@")
}

listening() {
  ss -ltnH "sport = :$1" 2>/dev/null || true
}

listener_pids() {
  ss -ltnpH "sport = :$1" 2>/dev/null | grep -o 'pid=[0-9]*' | cut -d= -f2 | sort -u || true
}

stop_emulators() {
  local serial
  if [[ -x "$adb" && -n "$(find_pids -x adb)" ]]; then
    while read -r serial; do
      echo "emulator: stopping $serial"
      "$adb" -s "$serial" emu kill >/dev/null 2>&1 || true
      acted=1
    done < <("$adb" devices | awk 'NR > 1 && $1 ~ /^emulator-/ { print $1 }')
  fi
  wait_for_none 20 -x 'qemu-system-.*' || true
}

stop_adb() {
  if [[ ! -x "$adb" ]]; then
    echo "adb: $adb not found, skipped"
    return 0
  fi
  if [[ -z "$(find_pids -x adb)" ]]; then
    return 0
  fi
  echo "adb: stopping the adb server"
  acted=1
  "$adb" kill-server >/dev/null 2>&1 || true
  wait_for_none 5 -x adb || true
}

stop_gradle() {
  local gradlew="$root/android/gradlew" candidate
  if [[ ! -f "$gradlew" ]]; then
    gradlew=""
    for candidate in "$root"/.claude/worktrees/*/android/gradlew; do
      if [[ -f "$candidate" ]]; then
        gradlew="$candidate"
        break
      fi
    done
  fi
  if [[ -n "$(find_pids -f 'GradleDaemon|KotlinCompileDaemon')" ]]; then
    acted=1
  fi
  if [[ -n "$gradlew" ]]; then
    (cd "$root" && "$gradlew" --stop >/dev/null 2>&1) || echo "gradle: $gradlew --stop failed"
  fi
  term_matching "gradle daemon" -f GradleDaemon
  term_matching "kotlin daemon" -f KotlinCompileDaemon
  wait_for_none 10 -f 'GradleDaemon|KotlinCompileDaemon' || true
}

stop_port() {
  local port="$1" pid pgid self_pgid
  self_pgid="$(ps -o pgid= -p $$ | tr -d ' ')"
  for pid in $(listener_pids "$port"); do
    if grep -qx "$pid" <<<"$(protected_pids)"; then
      continue
    fi
    pgid="$(ps -o pgid= -p "$pid" 2>/dev/null | tr -d ' ' || true)"
    echo "port $port: stopping pid $pid"
    acted=1
    if [[ -n "$pgid" && "$pgid" != "$self_pgid" ]]; then
      kill -TERM -- "-$pgid" 2>/dev/null || true
    else
      kill -TERM "$pid" 2>/dev/null || true
    fi
  done
}

wait_for_port_free() {
  local port="$1" i
  for ((i = 0; i < 20; i++)); do
    if [[ -z "$(listening "$port")" ]]; then
      return 0
    fi
    sleep 0.5
  done
}

still_running() {
  local label="$1" pids
  shift
  pids="$(find_pids "$@" | tr '\n' ' ')"
  if [[ -n "$pids" ]]; then
    echo "still running: $label pid(s) ${pids% }"
    alive=1
  fi
}

report() {
  local port line
  for port in 5037 ${ports[@]+"${ports[@]}"}; do
    line="$(listening "$port")"
    if [[ -n "$line" ]]; then
      echo "still listening on port $port: $line"
      alive=1
    fi
  done
  still_running "emulator" -x 'qemu-system-.*'
  still_running "adb server" -x adb
  still_running "gradle daemon" -f GradleDaemon
  still_running "kotlin daemon" -f KotlinCompileDaemon
}

stop_emulators
stop_adb
stop_gradle
for port in ${ports[@]+"${ports[@]}"}; do
  stop_port "$port"
  wait_for_port_free "$port"
done
report

if ((alive)); then
  exit 1
fi
if ((acted == 0)); then
  echo "nothing was running"
fi
exit 0
