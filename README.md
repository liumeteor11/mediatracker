# MediaTracker AI

An intelligent media tracking application powered by AI (Moonshot, OpenAI, DeepSeek, etc.). Search for books, movies, and shows, and organize them into collections with AI-driven recommendations and insights.

## Features

- **AI-Powered Tracking**: Automatically fetch details for books, movies, and TV series using advanced AI models.
- **Smart Search**: Integrated web search (Google, Bing, Yandex) for up-to-date information.
- **Privacy Focused**: Your API keys are encrypted and stored locally.
- **Multi-Provider Support**: Works with Moonshot AI (Kimi), OpenAI, DeepSeek, Qwen, Google Gemini, Mistral, and custom endpoints.
- **Dashboard**: Visual statistics of your media consumption.
- **Cross-Platform**: Available on Windows, macOS, and Linux (via Electron).

## Prerequisites

- Node.js v18 or higher
- npm or yarn

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/mediatracker-ai.git
   cd mediatracker-ai
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Copy `.env.example` to `.env` (or `.env.local`) and fill in the values.
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set your API keys:
   ```env
   # API Keys
   VITE_OMDB_API_KEY=your_omdb_api_key
   MOONSHOT_API_KEY=your_moonshot_api_key
   
   # App Configuration
   VITE_SECRET_KEY=your_secret_key_for_local_encryption
   ```

## Usage

### Development

Run the application in development mode (Vite + Electron):

```bash
npm run electron:dev
```

### Build

Build the application for production:

```bash
npm run electron:build
```

The output will be in the `release` directory.

## Configuration

You can configure the AI provider and search settings within the application's settings panel.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
