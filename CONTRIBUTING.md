# 🤝 Contributing to ShiftSafe-DT

Thank you for your interest in contributing to ShiftSafe-DT! This project aims to provide zero-touch parametric micro-insurance for gig economy workers.

## 🚀 Quick Start

### Prerequisites
- **Node.js** >= 20.x
- **Python** >= 3.12 (for AI Engine)
- **npm** >= 10.x

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/atul-upadhyay-7/ShiftSafe-DT.git
cd ShiftSafe-DT

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env.local
# Edit .env.local with your API keys (optional)

# 4. Seed the database
npm run seed

# 5. Start the development server
npm run dev

# 6. (Optional) Start the AI Engine
cd ai-engine
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## 📂 Project Structure

```
ShiftSafe-DT/
├── src/
│   ├── app/              # Next.js App Router pages & API routes
│   │   ├── api/          # REST API endpoints
│   │   ├── dashboard/    # Dashboard UI
│   │   ├── register/     # Registration flow
│   │   ├── policies/     # Policy management
│   │   └── claims/       # Claims history
│   ├── components/       # Reusable React components
│   └── lib/              # Core business logic
│       ├── db.ts         # SQLite database layer
│       ├── premium-engine.ts  # AI premium calculation
│       └── triggers.ts   # Parametric trigger engine
├── ai-engine/            # Python FastAPI AI Risk Engine
│   └── main.py           # XGBoost + Isolation Forest logic
├── .github/              # CI/CD, templates, workflows
└── public/               # Static assets
```

## 🔀 Branch Naming

- `feat/description` — New features
- `fix/description` — Bug fixes
- `docs/description` — Documentation
- `refactor/description` — Code refactoring
- `test/description` — Tests

## 💬 Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(api): add fraud detection endpoint
fix(ui): correct premium display on mobile
docs(readme): update installation instructions
refactor(lib): simplify trigger evaluation logic
```

## 🔍 Code Review

All PRs are automatically reviewed by:
- **CodeRabbit AI** — Automated code review with security & best practice checks
- **GitHub CodeQL** — Security vulnerability scanning
- **CI Pipeline** — Type checking, linting, and build verification

## 📜 License

By contributing, you agree that your contributions will be licensed under the project's ISC License.
