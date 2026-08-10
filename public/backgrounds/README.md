# Built-in background assets

English | [简体中文](README.zh-CN.md)

Place images in the directory for the surface that uses them. The settings UI discovers directory contents and generates its options automatically.

- `wallpaper/`: global window backgrounds
- `main/`: main-panel characters and scenes
- `sidebar/`: sidebar characters and scenes

Supported formats are PNG, JPEG, WebP, GIF, and AVIF. The filename without its extension becomes the option label; hyphens and underscores are displayed as spaces. Refresh the settings UI after adding or removing an asset in development. Packaged releases require a rebuild.
