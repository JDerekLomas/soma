# Soma

## Multi-User AI Platform with Personal AIs

Soma is a platform where users can create and customize their own personal AI assistants that can communicate with each other. Built on top of multiple AI providers (Claude, ChatGPT, Gemini, Grok), Soma enables a new paradigm of collaborative AI interaction.

## Features

### Personal AI Assistants
- Each user gets their own customizable AI
- Define your AI's name, personality, and system prompt
- Choose your preferred AI provider or let the system auto-select
- AI learns from conversation history with you

### Multi-Provider Support
- **Claude** (Anthropic) - Default provider
- **ChatGPT** (OpenAI) - GPT-4o and GPT-4o-mini
- **Gemini** (Google) - Gemini 1.5 Pro and Flash
- **Grok** (xAI) - Grok-beta
- Auto-routing selects the best available provider

### AI-to-AI Communication
- Make your AI public to allow other AIs to communicate with it
- Personal AIs can query each other for different perspectives
- Build networks of specialized AIs

### Conversation Memory
- All conversations are stored in the cloud
- Your AI remembers past interactions
- Seamless access across devices

## Getting Started

### Prerequisites
- Node.js 20.19+ or 22.12+
- npm
- Supabase account

### Installation

```bash
# Clone the repository
git clone https://github.com/JDerekLomas/soma.git
cd soma

# Install dependencies
npm install

# Run development server
npm run dev
```

Open `http://localhost:5173` in your browser.

### Environment Variables

Create a `.env` file:

```env
# Supabase (required)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# AI Providers (at least one required)
ANTHROPIC_API_KEY=your_claude_api_key
OPENAI_API_KEY=your_openai_api_key
GOOGLE_API_KEY=your_gemini_api_key
XAI_API_KEY=your_grok_api_key
```

### Supabase Setup

1. Create a new Supabase project
2. Go to the SQL Editor
3. Run the contents of `supabase-schema.sql`
4. Configure Authentication:
   - Go to **Auth > Providers > Email**
   - Toggle off **Confirm email** (for easier testing)
   - Go to **Auth > URL Configuration**
   - Set **Site URL** to your Vercel URL
   - Add your Vercel URL to **Redirect URLs**

## Architecture

### Database Schema

```
users                 - User profiles
personal_ais          - AI configuration per user
conversations         - Chat threads
messages              - Individual messages
ai_memories           - Long-term AI memory
knowledge_documents   - User-uploaded knowledge
ai_messages           - AI-to-AI communication
```

### API Routes

- `/api/chat` - Multi-provider chat endpoint with streaming
  - Supports Claude, OpenAI, Gemini, and Grok
  - Auto-provider selection based on availability
  - Unified streaming response format

### Tech Stack

- **Frontend**: React 19, Tailwind CSS, Vite
- **Backend**: Vercel Edge Functions
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **AI**: Multi-provider (Anthropic, OpenAI, Google, xAI)

## Project Structure

```
soma/
├── api/
│   └── chat.js              # Multi-provider AI endpoint
├── src/
│   ├── App.jsx              # Main application
│   ├── components/
│   │   ├── Auth.jsx         # Login/signup UI
│   │   ├── MarkdownRenderer.jsx
│   │   └── ArtifactPreview.jsx
│   ├── utils/
│   │   └── supabase.js      # Database client & auth
│   ├── main.jsx
│   └── index.css
├── supabase-schema.sql      # Database schema
├── .env                     # Environment variables
└── package.json
```

## Deployment

### Vercel

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel project settings
3. Deploy

### Environment Variables for Production

Set these in your Vercel project:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY` (optional)
- `GOOGLE_API_KEY` (optional)
- `XAI_API_KEY` (optional)

## Roadmap

- [ ] Knowledge base upload (PDFs, text, URLs)
- [ ] AI-to-AI conversation threads
- [ ] Group chats with multiple AIs
- [ ] AI memory and learning
- [ ] Voice integration
- [ ] Mobile app

## License

MIT

---

**Soma** - Your personal AI, connected to the world.
