# TorBox Manager

A modern, power-user focused alternative to the default TorBox UI. Built with Next.js for speed and efficiency.

## Features

### Core Download Management

- **Batch Upload**: Upload multiple torrent or NZB files and supported hoster or magnet links with a single click
- **Smart Downloads**: Cherry-pick specific files across multiple torrents
- **Multi-Format Support**: Manage torrents, Usenet (NZB), and web downloads all in one interface
- **File Selection**: Selectively download individual files from torrents
- **Download History**: Track and manage your download links with expiration tracking
- **Archived Downloads**: View and manage your archived download items

### Search & Discovery

- **Smart Search**: Search across multiple torrent sites directly from the interface
- **RSS Feed Management**:
  - Add and manage multiple RSS feeds
  - Automatic filtering with custom rules (title, description, category)
  - Auto-download based on filters

### Automation

- **Automation Rules**: Create smart automation rules for torrent management
  - Multiple condition types (status, ratio, speed, age, etc.)
  - Complex condition logic (AND/OR operators)
  - Preset rules for common scenarios
  - Rule execution logs and history
- **Self-Hosted Backend**: Optional 24/7 automation with persistent storage
  - Multi-user architecture with per-user database isolation
  - Run automation rules continuously in the background
  - SQLite database for data persistence
  - Intelligent polling based on user activity
  - State diffing for efficient change detection
  - Speed aggregation for performance metrics

### User Experience

- **Customizable Interface**: 
  - Resizable columns
  - Customizable table views
  - Card and list view modes
  - Status filtering
- **Multiple API Key Management**: Switch between multiple TorBox API keys
- **Notifications**: Real-time notification system for download events
- **Speed Charts**: Visualize download/upload speeds with interactive charts
- **Dark Mode**: Built-in dark mode support
- **Progressive Web App (PWA)**: Install as a standalone app
- **File Handler**: Direct file handling for `.torrent` and `.nzb` files

### User Management

- **User Profile**: View account information and settings
- **User Stats**: Track usage statistics

### Internationalization

- **Multi-Language Support**: Available in 6 languages
  - English (en)
  - German (de)
  - Spanish (es)
  - French (fr)
  - Japanese (ja)
  - Polish (pl)

## Getting Started

For deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md).

### Backend Architecture

The self-hosted backend uses a **multi-user architecture**:

- **Master Database**: Stores user registry and encrypted API keys
- **User Databases**: Separate SQLite database per user for data isolation
- **Connection Pooling**: LRU cache for efficient database connection management
- **Automatic Provisioning**: User databases are created on-demand when API keys are entered

### API Key Setup

1. Get your API key from [torbox.app/settings](https://torbox.app/settings)
2. Enter it in the application when prompted
3. The key is stored securely in your browser's localStorage
4. You can manage multiple API keys using the API Key Manager

## Requirements

- **Docker Deployment**: Docker and Docker Compose
- **Local Development**: Node.js 18.0 or later (or Bun)
- **Valid TorBox API key** (get yours from [torbox.app/settings](https://torbox.app/settings))

## Tech Stack

### Frontend
- **Next.js 15** with App Router
- **React 19** with hooks
- **Tailwind CSS** for styling
- **Zustand** for state management
- **next-intl** for internationalization
- **Chart.js** for data visualization
- **@dnd-kit** for drag-and-drop functionality
- **next-pwa** for Progressive Web App support

### Backend (Optional)
- **Express.js** web framework
- **SQLite** for master and per-user databases (data isolation)
- **Bun** runtime for high performance
- **Helmet** for security headers
- **CORS** for cross-origin requests
- **Automation Engine** with rule evaluation and state diffing
- **Connection Pooling** with LRU cache for scalability

## Project Structure

```
torbox-app/
├── src/
│   ├── app/              # Next.js app router pages
│   │   ├── [locale]/     # Internationalized routes
│   │   └── api/          # API route handlers
│   ├── components/       # React components
│   │   ├── downloads/      # Download management components
│   ├── contexts/         # React contexts
│   ├── hooks/            # Custom React hooks
│   ├── i18n/             # Internationalization config
│   ├── stores/           # Zustand stores
│   └── utils/            # Utility functions
├── backend/              # Self-hosted backend (optional)
│   ├── src/
│   │   ├── automation/   # Automation engine
│   │   │   ├── AutomationEngine.js    # Per-user rule engine
│   │   │   ├── RuleEvaluator.js       # Condition evaluation
│   │   │   ├── StateDiffEngine.js     # State change detection
│   │   │   ├── DerivedFieldsEngine.js # Computed fields
│   │   │   ├── SpeedAggregator.js     # Speed metrics
│   │   │   ├── PollingScheduler.js    # Intelligent polling
│   │   │   └── UserPoller.js          # API polling
│   │   ├── database/     # Database and migrations
│   │   │   ├── Database.js            # Master database
│   │   │   ├── UserDatabaseManager.js # User DB manager
│   │   │   ├── MigrationRunner.js     # Migration system
│   │   │   └── migrations/
│   │   │       ├── master/            # Master DB migrations
│   │   │       └── user/               # User DB migrations
│   │   ├── api/          # API client
│   │   └── utils/        # Utilities (crypto, status helpers)
└── public/               # Static assets
```

## Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.

### Development Setup

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Test thoroughly
5. Commit your changes: `git commit -m 'Add amazing feature'`
6. Push to the branch: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Code Style

- Follow the existing code style
- Use meaningful variable and function names
- Add comments for complex logic
- Ensure all new features are properly internationalized

## License

[GNU Affero General Public License v3.0](https://choosealicense.com/licenses/agpl-3.0/)

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.

Built with ❤️ for the TorBox community.