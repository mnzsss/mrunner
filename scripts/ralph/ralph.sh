#!/bin/bash
# Ralph Wiggum - Long-running AI agent loop
# Always runs in background. Use `rls` to check status.
# Usage: ./ralph.sh [--tool amp|claude|copilot] [--model MODEL] [max_iterations]

set -e

# Parse arguments
TOOL="claude"
MODEL="claude-sonnet-4.6"
MAX_ITERATIONS=10
LOOP_MODE=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --_loop)
      LOOP_MODE=true
      shift
      ;;
    --tool)
      TOOL="$2"
      shift 2
      ;;
    --tool=*)
      TOOL="${1#*=}"
      shift
      ;;
    --model)
      MODEL="$2"
      shift 2
      ;;
    --model=*)
      MODEL="${1#*=}"
      shift
      ;;
    *)
      if [[ "$1" =~ ^[0-9]+$ ]]; then
        MAX_ITERATIONS="$1"
      fi
      shift
      ;;
  esac
done

# Validate tool choice
if [[ "$TOOL" != "claude" && "$TOOL" != "copilot" ]]; then
  echo "Error: Invalid tool '$TOOL'. Must be 'claude' or 'copilot'."
  exit 1
fi

if [[ -z "$MODEL" ]]; then
  echo "Error: --model cannot be empty."
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRD_FILE="$SCRIPT_DIR/prd.json"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"
ARCHIVE_DIR="$SCRIPT_DIR/archive"
LAST_BRANCH_FILE="$SCRIPT_DIR/.last-branch"

# --- Background launcher (default) ---
if [[ "$LOOP_MODE" == "false" ]]; then
  LOG_DIR="$SCRIPT_DIR/logs"
  mkdir -p "$LOG_DIR"
  TIMESTAMP=$(date +%Y%m%d-%H%M%S)
  LOG_FILE="$LOG_DIR/ralph-$TIMESTAMP.log"
  PID_FILE="$SCRIPT_DIR/.ralph.pid"

  if [ -f "$PID_FILE" ]; then
    OLD_PID=$(cat "$PID_FILE")
    if kill -0 "$OLD_PID" 2>/dev/null; then
      echo "Ralph already running (PID $OLD_PID)"
      echo "Use 'rls' to check status or 'kill $OLD_PID' to stop"
      exit 1
    else
      rm -f "$PID_FILE"
    fi
  fi

  ln -sf "$LOG_FILE" "$LOG_DIR/latest.log"

  echo "Starting Ralph in background..."
  echo "  Tool: $TOOL"
  echo "  Model: $MODEL"
  echo "  Max iterations: $MAX_ITERATIONS"
  echo "  Log: $LOG_FILE"

  nohup "$SCRIPT_DIR/ralph.sh" --_loop --tool "$TOOL" --model "$MODEL" "$MAX_ITERATIONS" > "$LOG_FILE" 2>&1 &
  RALPH_PID=$!
  echo "$RALPH_PID" > "$PID_FILE"

  echo "  PID: $RALPH_PID"
  echo ""
  echo "Use 'rls' to check status"

  exit 0
fi

# --- Loop mode (called internally via --_loop) ---

# Archive previous run if branch changed
if [ -f "$PRD_FILE" ] && [ -f "$LAST_BRANCH_FILE" ]; then
  CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
  LAST_BRANCH=$(cat "$LAST_BRANCH_FILE" 2>/dev/null || echo "")

  if [ -n "$CURRENT_BRANCH" ] && [ -n "$LAST_BRANCH" ] && [ "$CURRENT_BRANCH" != "$LAST_BRANCH" ]; then
    DATE=$(date +%Y-%m-%d)
    FOLDER_NAME=$(echo "$LAST_BRANCH" | sed 's|^ralph/||')
    ARCHIVE_FOLDER="$ARCHIVE_DIR/$DATE-$FOLDER_NAME"

    echo "Archiving previous run: $LAST_BRANCH"
    mkdir -p "$ARCHIVE_FOLDER"
    [ -f "$PRD_FILE" ] && cp "$PRD_FILE" "$ARCHIVE_FOLDER/"
    [ -f "$PROGRESS_FILE" ] && cp "$PROGRESS_FILE" "$ARCHIVE_FOLDER/"
    echo "   Archived to: $ARCHIVE_FOLDER"

    echo "# Ralph Progress Log" > "$PROGRESS_FILE"
    echo "Started: $(date)" >> "$PROGRESS_FILE"
    echo "---" >> "$PROGRESS_FILE"
  fi
fi

# Track current branch
if [ -f "$PRD_FILE" ]; then
  CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
  if [ -n "$CURRENT_BRANCH" ]; then
    echo "$CURRENT_BRANCH" > "$LAST_BRANCH_FILE"
  fi
fi

# Initialize progress file if it doesn't exist
if [ ! -f "$PROGRESS_FILE" ]; then
  echo "# Ralph Progress Log" > "$PROGRESS_FILE"
  echo "Started: $(date)" >> "$PROGRESS_FILE"
  echo "---" >> "$PROGRESS_FILE"
fi

echo "Starting Ralph - Tool: $TOOL - Model: $MODEL - Max iterations: $MAX_ITERATIONS"

for i in $(seq 1 $MAX_ITERATIONS); do
  echo "$i/$MAX_ITERATIONS" > "$SCRIPT_DIR/.ralph.loop"
  echo ""
  echo "==============================================================="
  echo "  Ralph Iteration $i of $MAX_ITERATIONS ($TOOL)"
  echo "==============================================================="

  if [[ "$TOOL" == "amp" ]]; then
    OUTPUT=$(cat "$SCRIPT_DIR/prompt.md" | amp --dangerously-allow-all 2>&1) || true
  elif [[ "$TOOL" == "claude" ]]; then
    OUTPUT=$(claude --dangerously-skip-permissions --model "$MODEL" --print < "$SCRIPT_DIR/CLAUDE.md" 2>&1) || true
  else
    OUTPUT=$(gh copilot -- -p "$(cat "$SCRIPT_DIR/CLAUDE.md")" --model "$MODEL" --allow-all-tools --allow-all-paths --allow-all-urls -s 2>&1) || true
  fi

  if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
    echo ""
    rm -f "$SCRIPT_DIR/.ralph.loop"
    rm -f "$SCRIPT_DIR/.ralph.pid"
    echo "Ralph completed all tasks!"
    echo "Completed at iteration $i of $MAX_ITERATIONS"
    exit 0
  fi

  echo "Iteration $i complete. Continuing..."
  echo "Output:"
  echo "---------------------------------------------------------------"
  echo "$OUTPUT"
  echo ""
  sleep 2
done

rm -f "$SCRIPT_DIR/.ralph.loop"
rm -f "$SCRIPT_DIR/.ralph.pid"
echo ""
echo "Ralph reached max iterations ($MAX_ITERATIONS) without completing all tasks."
echo "Check $PROGRESS_FILE for status."
exit 1
