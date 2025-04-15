#!/usr/bin/env bash
# util for locally generating PDFs for a continuous range of UIDs by calling generate-pdf route

if [ "$#" -ne 2 ]; then
  echo "Usage: $0 start_num end_num"
  exit 1
fi

start=$1
end=$2

for ((a=start; a<=end; a++)); do
  padded_num=$(printf "%06d" $a)
  curl "http://localhost:3000/api/airtable/generate-pdf?uid=WHS-$padded_num" \
    -H "Authorization: Bearer $CRON_SECRET"
done
