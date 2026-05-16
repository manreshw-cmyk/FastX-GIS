import json
import pathlib
import subprocess

from pypinyin import Style, lazy_pinyin


def load_home_data() -> dict:
    output = subprocess.check_output(
        [
            "node",
            "-e",
            "import('./src/common/home-content.js').then(m=>console.log(JSON.stringify({menu:m.homeMenuTree,sections:m.homeContentSections})))",
        ],
        text=True,
        encoding="utf-8",
    )
    return json.loads(output)


def to_initials(text: str) -> str:
    raw = "".join(lazy_pinyin(text, style=Style.FIRST_LETTER, errors="ignore")).lower()
    value = "".join(ch for ch in raw if ch.isalnum())
    return value or "demo"


def main() -> None:
    data = load_home_data()
    menu = data["menu"]
    sections = {section["key"]: section for section in data["sections"]}
    root = pathlib.Path("src/views/mapDemo")
    root.mkdir(parents=True, exist_ok=True)

    used_names: dict[str, str] = {}
    mapping: list[dict[str, str]] = []

    for group in menu:
        section = sections.get(group["key"], {"cards": []})
        for card in section.get("cards", []):
            card_key = card.get("key", "")
            title = card.get("title", "")
            base_name = to_initials(title)
            file_name = base_name
            suffix = 2
            while file_name in used_names and used_names[file_name] != card_key:
                file_name = f"{base_name}{suffix}"
                suffix += 1
            used_names[file_name] = card_key

            component_path = root / f"{file_name}.vue"
            component_path.write_text(
                "\n".join(
                    [
                        "<script setup lang='ts'>",
                        f"const title = {title!r}",
                        f"const cardKey = {card_key!r}",
                        "</script>",
                        "",
                        "<template>",
                        "  <div class='demo-page'>",
                        "    <a-card :title='title' :bordered='false'>",
                        "      <p>当前功能卡片 Key：{{ cardKey }}</p>",
                        "      <p>功能内容开发中，后续将在此处接入 CesiumX 能力。</p>",
                        "    </a-card>",
                        "  </div>",
                        "</template>",
                        "",
                        "<style scoped lang='scss'>",
                        ".demo-page {",
                        "  padding: 16px;",
                        "}",
                        "</style>",
                        "",
                    ]
                ),
                encoding="utf-8",
            )

            mapping.append(
                {
                    "key": card_key,
                    "title": title,
                    "fileName": file_name,
                    "componentPath": f"./{file_name}.vue",
                }
            )

    (root / "component-map.json").write_text(
        json.dumps(mapping, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    ts_lines = [
        "export interface MapDemoComponentMeta {",
        "  key: string",
        "  title: string",
        "  fileName: string",
        "  componentPath: string",
        "}",
        "",
        "export const mapDemoComponentMetaList: MapDemoComponentMeta[] = [",
    ]
    ts_lines.extend(
        [
            f"  {{ key: {item['key']!r}, title: {item['title']!r}, fileName: {item['fileName']!r}, componentPath: {item['componentPath']!r} }},"
            for item in mapping
        ]
    )
    ts_lines.extend(
        [
            "]",
            "",
            "export const mapDemoComponentMetaMap: Record<string, MapDemoComponentMeta> = Object.fromEntries(",
            "  mapDemoComponentMetaList.map((item) => [item.key, item]),",
            ")",
            "",
        ]
    )
    (root / "component-map.ts").write_text("\n".join(ts_lines), encoding="utf-8")
    print(f"Generated {len(mapping)} Vue files.")


if __name__ == "__main__":
    main()
