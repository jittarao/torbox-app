# TorBox Manager

A modern, power-user focused alternative to the default TorBox UI. Built with Next.js for speed and efficiency.

## Features

- **Batch Upload**: Upload multiple torrents with a single click
- **Smart Downloads**: Cherry-pick specific files across multiple torrents
- **Customizable Interface**: Tailor the workflow to match your needs
- **Automation Rules**: Smart automation for torrent management
- **Self-Hosted Backend**: Optional 24/7 automation with persistent storage

## Getting Started

### Docker (Recommended)

1. Clone the repository:
```bash
git clone https://github.com/crazycacti/torbox-app.git
cd torbox-app
```

2. Start the application:
```bash
docker compose up -d
```

3. Open [http://localhost:3000](http://localhost:3000) and enter your TorBox API key to begin.

### Self-Hosted Backend (24/7 Automation)

1. Clone the repository:
```bash
git clone https://github.com/crazycacti/torbox-app.git
cd torbox-app
```

2. Enable the backend by uncommenting the backend section in `docker-compose.yml`

3. Start with backend:
```bash
docker compose up -d
```

4. Open [http://localhost:3000](http://localhost:3000) and enter your TorBox API key - automation rules will now run 24/7!

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/crazycacti/torbox-app.git
cd torbox-app
```

2. Install dependencies:
```bash
bun install
```

3. Run the development server:
```bash
bun run dev
```

4. Open [http://localhost:3000](http://localhost:3000) and enter your TorBox API key to begin.

## Deployment Options

| Option | Use Case | Automation | Storage | Complexity |
|--------|----------|------------|---------|------------|
| **Frontend Only** | Standard usage | Browser-based | Local storage | Simple |
| **Self-Hosted Backend** | 24/7 automation | Background | Database + local | Moderate |

## Requirements

- Docker and Docker Compose (for Docker deployment)
- Node.js 18.0 or later (for local development)
- A running TorBox instance with API access
- Valid TorBox API key

## Tech Stack

- Next.js 15 with App Router
- React 19 with hooks
- Tailwind CSS
- Zustand for state management
- next-intl for internationalization

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## License

[GNU Affero General Public License v3.0](https://choosealicense.com/licenses/agpl-3.0/)

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.
