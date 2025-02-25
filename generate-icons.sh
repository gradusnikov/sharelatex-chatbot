#!/bin/bash

# Array of icon sizes
sizes=(16 32 48 128)

# Input SVG file
input="icon.svg"

# Output directory for generated PNG files
output_dir="icons"

# Create output directory if it doesn't exist
mkdir -p "$output_dir"

# Check if input file exists
if [ ! -f "$input" ]; then
  echo "Error: $input not found."
  exit 1
fi

# Loop through each size and generate a PNG
for size in "${sizes[@]}"; do
  output_file="${output_dir}/icon_${size}x${size}.png"
  convert -background none -resize "${size}x${size}" "$input" "$output_file"
  if [ $? -eq 0 ]; then
    echo "Generated $output_file"
  else
    echo "Error generating $output_file"
  fi
done
