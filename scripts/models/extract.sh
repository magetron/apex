# Extracts a downloaded model archive for #/dev/convert (each into its own fresh folder).
# usage: bash scripts/models/extract.sh <archive in models/> <vehicle-id>
#   → .tools/tmp/models/<vehicle-id>/model.fbx + its textures
# Archives come two ways: source/<inner>.zip holding the FBX (+ textures), or the FBX straight
# in source/ with its textures in textures/.
set -e
zip="models/$1"
out=".tools/tmp/models/$2"
for i in 1 2 3 4 5; do rm -rf "$out" 2>/dev/null && break; sleep 1; done
mkdir -p "$out/outer"
unzip -o -q "$zip" -d "$out/outer"
inner=$(ls "$out"/outer/source/*.zip 2>/dev/null | head -n1)
if [ -n "$inner" ]; then
  unzip -o -q "$inner" -d "$out"
else
  cp "$out"/outer/source/* "$out"/
fi
# textures shipped beside the source fill any the source lacks
cp -n "$out"/outer/textures/* "$out"/ 2>/dev/null || true
rm -rf "$out/outer" 2>/dev/null || true  # Dropbox/AV may hold fresh files briefly; it is only scratch
fbx=$(ls "$out"/*.fbx | head -n1)
[ "$fbx" = "$out/model.fbx" ] || mv "$fbx" "$out/model.fbx"
echo "$2: $(ls "$out" | wc -l) files"
