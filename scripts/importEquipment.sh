#!/bin/bash

# Supabase credentials
SUPABASE_URL="https://gnukhwfbslnmmmcjdzjh.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdudWtod2Zic2xubW1tY2pkempoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4MTUzMTYsImV4cCI6MjA5MjM5MTMxNn0.R_Zih-L5Ns3sNNRE-qEehloNWA8A0zXmyGDjium83ys"

# Equipment data as JSON array
EQUIPMENT_DATA='[
  {"name": "HPLC System", "brand": "Agilent", "model": "HP 1200", "laboratory_id": 1, "quantity": 2, "available_quantity": 2, "status": "available"},
  {"name": "GC-MS", "brand": "Shimadzu", "model": "QP2010 Plus", "laboratory_id": 1, "quantity": 1, "available_quantity": 1, "status": "available"},
  {"name": "Rotary Evaporator", "brand": "IKA", "model": "RV 10", "laboratory_id": 1, "quantity": 3, "available_quantity": 2, "status": "available"},
  {"name": "Ultrasonic Bath", "brand": "Branson", "model": "3800", "laboratory_id": 1, "quantity": 2, "available_quantity": 2, "status": "available"},
  {"name": "Freeze Dryer", "brand": "Labconco", "model": "FreeZone", "laboratory_id": 1, "quantity": 1, "available_quantity": 1, "status": "available"},
  {"name": "Analytical Balance", "brand": "Sartorius", "model": "Cubis", "laboratory_id": 1, "quantity": 4, "available_quantity": 3, "status": "available"},
  {"name": "Fume Hood", "brand": "Thermo", "model": "Series 4000", "laboratory_id": 1, "quantity": 3, "available_quantity": 2, "status": "available"},
  {"name": "PCR Machine", "brand": "Bio-Rad", "model": "CFX96", "laboratory_id": 2, "quantity": 3, "available_quantity": 2, "status": "available"},
  {"name": "Gel Electrophoresis System", "brand": "Bio-Rad", "model": "PowerPac Basic", "laboratory_id": 2, "quantity": 4, "available_quantity": 3, "status": "available"},
  {"name": "Microplate Reader", "brand": "Tecan", "model": "Infinite Pro", "laboratory_id": 2, "quantity": 2, "available_quantity": 1, "status": "available"},
  {"name": "Incubator", "brand": "Thermo", "model": "Heratherm", "laboratory_id": 2, "quantity": 3, "available_quantity": 2, "status": "available"},
  {"name": "Biosafety Cabinet", "brand": "Thermo", "model": "MSC-Advance", "laboratory_id": 2, "quantity": 2, "available_quantity": 2, "status": "available"},
  {"name": "DNA Sequencer", "brand": "Illumina", "model": "MiSeq", "laboratory_id": 3, "quantity": 1, "available_quantity": 1, "status": "available"},
  {"name": "Thermocycler", "brand": "Applied Biosystems", "model": "ProFlex", "laboratory_id": 3, "quantity": 2, "available_quantity": 2, "status": "available"},
  {"name": "Gel Documentation System", "brand": "Bio-Rad", "model": "ChemiDoc MP", "laboratory_id": 3, "quantity": 1, "available_quantity": 1, "status": "available"},
  {"name": "Electroporation Equipment", "brand": "Bio-Rad", "model": "Gene Pulser Xcell", "laboratory_id": 3, "quantity": 1, "available_quantity": 1, "status": "available"},
  {"name": "LC-MS/MS System", "brand": "Agilent", "model": "6470", "laboratory_id": 4, "quantity": 1, "available_quantity": 1, "status": "available"},
  {"name": "NMR Spectrometer", "brand": "Bruker", "model": "AVANCE III", "laboratory_id": 4, "quantity": 1, "available_quantity": 0, "status": "available"},
  {"name": "FTIR Spectrometer", "brand": "Thermo", "model": "Nicolet iS5", "laboratory_id": 4, "quantity": 1, "available_quantity": 1, "status": "available"},
  {"name": "UV-Vis Spectrophotometer", "brand": "Shimadzu", "model": "UV-2600", "laboratory_id": 4, "quantity": 2, "available_quantity": 2, "status": "available"},
  {"name": "Automated DNA Extractor", "brand": "Qiagen", "model": "EZ1", "laboratory_id": 5, "quantity": 1, "available_quantity": 1, "status": "available"},
  {"name": "Capillary Electrophoresis System", "brand": "Agilent", "model": "3500xL", "laboratory_id": 5, "quantity": 1, "available_quantity": 1, "status": "available"},
  {"name": "Real-time PCR", "brand": "Bio-Rad", "model": "CFX Connect", "laboratory_id": 5, "quantity": 2, "available_quantity": 1, "status": "available"},
  {"name": "Autoclave System", "brand": "Systec", "model": "D-65", "laboratory_id": 6, "quantity": 2, "available_quantity": 2, "status": "available"},
  {"name": "Laminar Flow Hood", "brand": "Thermo", "model": "KingFisher", "laboratory_id": 6, "quantity": 2, "available_quantity": 2, "status": "available"},
  {"name": "Laboratory Incubator", "brand": "Memmert", "model": "IN55", "laboratory_id": 6, "quantity": 3, "available_quantity": 3, "status": "available"},
  {"name": "Microscope", "brand": "Olympus", "model": "BX53", "laboratory_id": 6, "quantity": 3, "available_quantity": 2, "status": "available"},
  {"name": "Mass Spectrometer", "brand": "Thermo", "model": "Q Exactive Plus", "laboratory_id": 7, "quantity": 1, "available_quantity": 1, "status": "available"},
  {"name": "High-resolution Microscope", "brand": "Zeiss", "model": "Axio Imager", "laboratory_id": 7, "quantity": 2, "available_quantity": 1, "status": "available"},
  {"name": "Particle Size Analyzer", "brand": "Malvern", "model": "Zetasizer Ultra", "laboratory_id": 7, "quantity": 1, "available_quantity": 1, "status": "available"},
  {"name": "Cryopreservation System", "brand": "Eppendorf", "model": "CryoCube", "laboratory_id": 8, "quantity": 1, "available_quantity": 1, "status": "available"},
  {"name": "Freeze Dryer System", "brand": "Virtis", "model": "Genesis", "laboratory_id": 8, "quantity": 1, "available_quantity": 1, "status": "available"},
  {"name": "Fermentation Equipment", "brand": "Infors", "model": "Multifors", "laboratory_id": 8, "quantity": 2, "available_quantity": 1, "status": "available"}
]'

echo "🔄 Starting equipment import to Supabase..."
echo "📦 Inserting 33 equipment items..."

# Make the API request
RESPONSE=$(curl -X POST \
  "${SUPABASE_URL}/rest/v1/equipment" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "${EQUIPMENT_DATA}" \
  2>&1)

# Check if successful
if echo "$RESPONSE" | grep -q "apikey"; then
  echo "❌ Error: Missing or invalid API key"
  echo "$RESPONSE"
else
  echo "✅ Response received:"
  echo "$RESPONSE"
fi
