#!/bin/zsh
# Run waves FROM..TO sequentially (rate limits), retrying an incomplete wave whole, up to 3 times.
#   usage: run_all.sh <waves.json> <from> <to> <repo-dir> <out-dir>     env: PAUSE (s between waves)
H=${0:a:h}; WAVES=$1; REPO=$4; OUT=$5
for W in $(seq $2 $3); do
  [[ -f $OUT/wave$W.done ]] && continue
  for attempt in 1 2 3; do
    $H/run_wave.sh $WAVES $W $REPO $OUT >> $OUT/progress.log 2>&1
    python3 $H/extract.py $WAVES $W $REPO $OUT >> $OUT/progress.log 2>&1
    if python3 $H/check_wave.py $WAVES $W $OUT; then touch $OUT/wave$W.done; sleep ${PAUSE:-0}; break; fi
    echo "wave $W attempt $attempt incomplete — retrying whole" >> $OUT/progress.log; sleep ${RETRY_PAUSE:-60}
  done
done
echo "DONE $2-$3" >> $OUT/progress.log
