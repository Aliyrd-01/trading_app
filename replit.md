# Crypto Analyzer

A Flask-based cryptocurrency analysis web application that provides trading signals and market analysis.

## Overview

This application allows users to:
- Analyze cryptocurrency trading pairs
- Get automated trading signals
- Generate trading reports with entry/exit points
- Set up notifications via Telegram or email

## Project Structure

- `app.py` - Main Flask application with routes and database models
- `trading_app.py` - Core trading analysis logic and indicator calculations
- `models.py` - SQLAlchemy database models (User, ReportV2)
- `templates/` - HTML templates (login, index)
- `static/` - CSS, JavaScript, and translation files
- `core/` - Additional calculation modules

## Configuration

### Database
The application uses PostgreSQL when `DATABASE_URL` environment variable is set (default on Replit), or falls back to SQLite for local development.

### Environment Variables
- `DATABASE_URL` - PostgreSQL connection string (auto-configured on Replit)
- `TELEGRAM_BOT_TOKEN` - For Telegram notifications (optional)
- `RESEND_API_KEY` - For email notifications via Resend (optional)
- `SMTP_*` - SMTP settings for email notifications (optional)

## Running the Application

The app runs on port 5000 with:
```
python app.py
```

## Tech Stack
- Python 3.11
- Flask (web framework)
- SQLAlchemy (ORM)
- CCXT (cryptocurrency exchange library)
- Pandas/NumPy/SciPy (data analysis)
- Matplotlib (charting)
