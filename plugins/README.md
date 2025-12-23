# Custom Plugins

Create your own commands by adding JSON files to `~/.config/mrunner/plugins/`.

## Plugin Format

```json
{
  "id": "my-custom-command",
  "name": "My Custom Command",
  "description": "Does something cool",
  "icon": "terminal",
  "group": "Custom",
  "keywords": ["custom", "my", "command"],
  "action": {
    "type": "shell",
    "command": "echo 'Hello, World!'"
  }
}
```

## Action Types

### Shell Command

```json
{
  "action": {
    "type": "shell",
    "command": "your-command-here"
  }
}
```

### Open File/Folder

```json
{
  "action": {
    "type": "open",
    "path": "/path/to/file/or/folder"
  }
}
```

### Open URL

```json
{
  "action": {
    "type": "url",
    "url": "https://example.com"
  }
}
```

## Available Icons

- search
- calculator
- globe
- bookmark
- clipboard
- settings
- power
- folder
- terminal
- music
- code
- file
- hash
- cpu
- monitor
- wifi
- bluetooth
- volume
- sun
- moon

## Examples

### Open GitHub

```json
{
  "id": "open-github",
  "name": "GitHub",
  "description": "Open GitHub in browser",
  "icon": "globe",
  "group": "Links",
  "keywords": ["github", "git", "code"],
  "action": {
    "type": "url",
    "url": "https://github.com"
  }
}
```

### Run Docker Compose

```json
{
  "id": "docker-up",
  "name": "Docker Compose Up",
  "description": "Start Docker containers",
  "icon": "terminal",
  "group": "Dev",
  "keywords": ["docker", "compose", "start"],
  "action": {
    "type": "shell",
    "command": "cd ~/Projects/myapp && docker-compose up -d"
  }
}
```
