# usage: bash scripts/likeness/url.sh "File name.jpg"  → size + 1280px thumb URL (upload.wikimedia.org)
f="${1// /_}"
curl -s -A "apex-edu/0.1" "https://commons.wikimedia.org/w/api.php?action=query&prop=imageinfo&iiprop=url|size&format=json&titles=File:$f" | grep -oE '"(url|width|height)":("[^"]*"|[0-9]+)' | sed "s/?utm[^\"]*//g" | tr '\n' ' ' | sed -E 's#"url":"https://upload.wikimedia.org/wikipedia/commons/([0-9a-f]/[0-9a-f]{2})/([^"]*)"#https://upload.wikimedia.org/wikipedia/commons/thumb/\1/\2/1280px-\2#'
echo
