# pi-codesight

CodeSight context tools for Pi.

## Install

```bash
pi install npm:pi-codesight
pi install git:github.com/anh-chu/pi-codesight
npm install pi-codesight
```

## What this extension adds

- `codesight_get_wiki_index`
- `codesight_get_wiki_article`
- `codesight_get_summary`
- `codesight_get_routes`
- `codesight_get_schema`
- `codesight_get_blast_radius`
- `codesight_get_env`
- `codesight_get_hot_files`
- `codesight_refresh`

## Usage notes

- Run `codesight_refresh` when artifacts missing or stale.
- Extension reads artifacts from `.codesight/` and keeps generation user-triggered.
