import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'en' | 'uk' | 'ru';

interface Translations {
  [key: string]: {
    en: string;
    uk: string;
    ru: string;
  };
}

const translations: Translations = {
  'header.tradingAnalyzer': {
    en: 'Trading Analyzer',
    uk: 'Торговий Аналізатор',
    ru: 'Торговый Анализатор'
  },
  'header.arbitrageTool': {
    en: 'Arbitrage Tool',
    uk: 'Інструмент Арбітражу',
    ru: 'Инструмент Арбитража'
  },
  'header.prices': {
    en: 'Prices',
    uk: 'Тарифи',
    ru: 'Тарифы'
  },
  'header.faq': {
    en: 'FAQ',
    uk: 'FAQ',
    ru: 'FAQ'
  },
  'header.signIn': {
    en: 'Sign In',
    uk: 'Увійти',
    ru: 'Войти'
  },
  'header.signUp': {
    en: 'Sign Up',
    uk: 'Реєстрація',
    ru: 'Регистрация'
  },
  'header.dashboard': {
    en: 'Dashboard',
    uk: 'Панель',
    ru: 'Панель'
  },
  'header.home': {
    en: 'Home',
    uk: 'Головна',
    ru: 'Главная'
  },
  'hero.title': {
    en: 'Smart Trading Tools for Crypto Markets',
    uk: 'Розумні Торгові Інструменти для Крипторинків',
    ru: 'Умные Торговые Инструменты для Крипторынков'
  },
  'hero.description': {
    en: 'Advanced analysis and arbitrage tools designed for serious traders. Get real-time signals, indicator analysis, and maximize your profit potential across exchanges.',
    uk: 'Передові інструменти аналізу та арбітражу для серйозних трейдерів. Отримуйте сигнали в реальному часі, аналіз індикаторів та максимізуйте потенціал прибутку на біржах.',
    ru: 'Передовые инструменты анализа и арбитража для серьезных трейдеров. Получайте сигналы в реальном времени, анализ индикаторов и максимизируйте потенциал прибыли на биржах.'
  },
  'hero.downloadApp': {
    en: 'Download App',
    uk: 'Завантажити',
    ru: 'Скачать'
  },
  'hero.demoMode': {
    en: 'Demo Mode',
    uk: 'Демо Режим',
    ru: 'Демо Режим'
  },
  'hero.learnMore': {
    en: 'Learn More',
    uk: 'Дізнатися Більше',
    ru: 'Узнать Больше'
  },
  'learnMore.title': {
    en: 'Learn More About Our Tools',
    uk: 'Дізнайтесь Більше Про Наші Інструменти',
    ru: 'Узнайте больше о наших инструментах'
  },
  'learnMore.subtitle': {
    en: 'How the Crypto Trading Analyzer works today and what will be available in the upcoming Arbitrage app.',
    uk: 'Як працює Crypto Trading Analyzer сьогодні та що з’явиться у майбутньому застосунку для арбітражу.',
    ru: 'Как работает Crypto Trading Analyzer сегодня и что появится в будущем приложении для арбитража.'
  },
  'learnMore.openDemo': {
    en: 'Open Demo',
    uk: 'Відкрити Демо',
    ru: 'Открыть демо'
  },
  'learnMore.download': {
    en: 'Download App',
    uk: 'Завантажити',
    ru: 'Скачать приложение'
  },
  'faq.title': {
    en: 'Frequently Asked Questions',
    uk: 'Поширені запитання',
    ru: 'Часто задаваемые вопросы'
  },
  'faq.subtitle': {
    en: 'Answers about the Web App, Desktop App, payments, and basic account topics.',
    uk: 'Відповіді про Web App, Desktop App, оплату та основні питання щодо акаунта.',
    ru: 'Ответы про Web App, Desktop App, оплату и базовые вопросы по аккаунту.'
  },
  'faq.webApp.title': {
    en: 'Web App',
    uk: 'Web App',
    ru: 'Web App'
  },
  'faq.webApp.subtitle': {
    en: 'Auto-signals, timeframes, payment, and support for the web version.',
    uk: 'Автосигнали, таймфрейми, оплата та підтримка веб-версії.',
    ru: 'Автосигналы, таймфреймы, оплата и поддержка веб-версии.'
  },
  'faq.webApp.q.autosignalsWhat': {
    en: 'What are auto-signals?',
    uk: 'Що таке автосигнали?',
    ru: 'Что такое автосигналы?'
  },
  'faq.webApp.a.autosignalsWhat': {
    en: 'Auto-signals are automated trade ideas generated from indicator confirmations and rules. They help you spot setups faster, but they are not financial advice.',
    uk: 'Автосигнали — це автоматичні торгові ідеї, згенеровані на основі підтверджень індикаторів та правил. Вони допомагають швидше знаходити сетапи, але це не фінансова порада.',
    ru: 'Автосигналы — это автоматические торговые идеи на основе подтверждений индикаторов и правил. Они помогают быстрее находить сетапы, но это не финансовый совет.'
  },
  'faq.webApp.q.bestTimeframes': {
    en: 'Which timeframes are best?',
    uk: 'Які таймфрейми найкращі?',
    ru: 'Какие таймфреймы лучше использовать?'
  },
  'faq.webApp.a.bestTimeframesIntro': {
    en: 'It depends on your trading style. A good starting point:',
    uk: 'Залежить від стилю торгівлі. Гарний стартовий варіант:',
    ru: 'Зависит от стиля торговли. Хорошая стартовая схема:'
  },
  'faq.webApp.a.bestTimeframesScalping': {
    en: 'Scalping: 1m–15m',
    uk: 'Скальпінг: 1m–15m',
    ru: 'Скальпинг: 1m–15m'
  },
  'faq.webApp.a.bestTimeframesDaytrading': {
    en: 'Day trading: 15m–1h',
    uk: 'Дейтрейдинг: 15m–1h',
    ru: 'Дейтрейдинг: 15m–1h'
  },
  'faq.webApp.a.bestTimeframesSwing': {
    en: 'Swing: 4h–1D',
    uk: 'Свінг: 4h–1D',
    ru: 'Свинг: 4h–1D'
  },
  'faq.webApp.a.bestTimeframesMedium': {
    en: 'Medium-term: 1D–1W',
    uk: 'Середньостроково: 1D–1W',
    ru: 'Среднесрок: 1D–1W'
  },
  'faq.webApp.a.bestTimeframesLong': {
    en: 'Long-term: 1W+',
    uk: 'Довгостроково: 1W+',
    ru: 'Долгосрок: 1W+'
  },
  'faq.webApp.a.bestTimeframesNote': {
    en: 'Tip: use higher timeframes for trend direction and lower timeframes for entries.',
    uk: 'Порада: вищі таймфрейми — для напрямку тренду, нижчі — для входу.',
    ru: 'Совет: старшие таймфреймы — для направления тренда, младшие — для входа.'
  },
  'faq.webApp.q.howToPay': {
    en: 'How do I pay for a plan?',
    uk: 'Як оплатити підписку?',
    ru: 'Как оплатить подписку?'
  },
  'faq.webApp.a.howToPayIntro': {
    en: 'You can pay with cryptocurrency. Supported options:',
    uk: 'Ви можете оплатити криптовалютою. Підтримуються:',
    ru: 'Вы можете оплатить криптовалютой. Поддерживаются:'
  },
  'faq.webApp.a.howToPayCoinBtc': {
    en: 'BTC',
    uk: 'BTC',
    ru: 'BTC'
  },
  'faq.webApp.a.howToPayCoinEth': {
    en: 'ETH (ERC20)',
    uk: 'ETH (ERC20)',
    ru: 'ETH (ERC20)'
  },
  'faq.webApp.a.howToPayCoinTrx': {
    en: 'TRX (TRC20)',
    uk: 'TRX (TRC20)',
    ru: 'TRX (TRC20)'
  },
  'faq.webApp.a.howToPayCoinUsdc': {
    en: 'USDC (ERC20)',
    uk: 'USDC (ERC20)',
    ru: 'USDC (ERC20)'
  },
  'faq.webApp.a.howToPayNote': {
    en: 'After payment, keep the transaction hash (TXID) — support can use it to confirm the transfer.',
    uk: 'Після оплати збережіть хеш транзакції (TXID) — підтримка може використати його для підтвердження.',
    ru: 'После оплаты сохраните хэш транзакции (TXID) — поддержка может использовать его для подтверждения.'
  },
  'faq.webApp.q.support': {
    en: 'How can I contact support?',
    uk: 'Як зв’язатися з підтримкою?',
    ru: 'Как связаться с поддержкой?'
  },
  'faq.webApp.a.support': {
    en: 'Contact us via Telegram or email. Also, the app includes a built-in feedback form. We usually reply within 24 hours on business days.',
    uk: 'Напишіть нам у Telegram або на email. Також у додатку є вбудована форма зворотного зв’язку. Зазвичай відповідаємо протягом 24 годин у робочі дні.',
    ru: 'Напишите нам в Telegram или на email. Также в приложении есть встроенная форма обратной связи. Обычно отвечаем в течение 24 часов в рабочие дни.'
  },
  'faq.desktopApp.title': {
    en: 'Desktop App',
    uk: 'Desktop App',
    ru: 'Desktop App'
  },
  'faq.desktopApp.subtitle': {
    en: 'Installation, confirmations, settings, logs, and demo mode.',
    uk: 'Встановлення, підтвердження, налаштування, логи та демо-режим.',
    ru: 'Установка, подтверждения, настройки, логи и демо-режим.'
  },
  'faq.desktopApp.q.howToStart': {
    en: 'How do I start using the Desktop App?',
    uk: 'Як почати користуватися Desktop App?',
    ru: 'Как начать пользоваться Desktop App?'
  },
  'faq.desktopApp.a.howToStart': {
    en: 'Download the installer, install the app, choose a pair and trading style, then run analysis to get a structured report on crypto exchange trading.',
    uk: 'Завантажте інсталятор, встановіть додаток, оберіть пару та стиль торгівлі, а потім запустіть аналіз — ви отримаєте структурований звіт по торгівлі на криптобіржі.',
    ru: 'Скачайте установщик, установите приложение, выберите пару и стиль торговли, затем запустите анализ — получите структурированный отчёт по торговле на криптобирже.'
  },
  'faq.desktopApp.q.confirmations': {
    en: 'What are confirmations?',
    uk: 'Що таке підтвердження?',
    ru: 'Что такое подтверждения?'
  },
  'faq.desktopApp.a.confirmations': {
    en: 'Confirmations are additional indicator checks that validate a setup (e.g., RSI/MA trend/volume). More confirmations can mean fewer but stronger signals.',
    uk: 'Підтвердження — це додаткові перевірки індикаторів, які підтверджують сетап (наприклад RSI/тренд MA/обʼєм). Більше підтверджень — менше, але сильніші сигнали.',
    ru: 'Подтверждения — это дополнительные проверки индикаторов, которые подтверждают сетап (например RSI/тренд MA/объём). Больше подтверждений — меньше, но сильнее сигналы.'
  },
  'faq.desktopApp.q.settings': {
    en: 'Where can I change risk and strategy settings?',
    uk: 'Де змінювати ризик і налаштування стратегій?',
    ru: 'Где менять риск и настройки стратегий?'
  },
  'faq.desktopApp.a.settings': {
    en: 'Use Advanced mode to configure timeframes, confirmations, risk parameters, and additional analysis options.',
    uk: 'Використовуйте Advanced режим, щоб налаштувати таймфрейми, підтвердження, параметри ризику та додаткові опції аналізу.',
    ru: 'Используйте Advanced режим, чтобы настроить таймфреймы, подтверждения, параметры риска и дополнительные опции анализа.'
  },
  'faq.desktopApp.q.tradingviewWebhook': {
    en: 'How do I connect TradingView alerts (webhook)?',
    uk: 'Як підключити алерти TradingView (webhook)?',
    ru: 'Как подключить TradingView (webhook)?'
  },
  'faq.desktopApp.a.tradingviewWebhook': {
    en: '1) In the Desktop App, enable Telegram and/or Email notifications in Settings and save.\n\n2) In TradingView, create an Alert and enable Webhook URL.\nWebhook URL: https://cryptoanalyz.net/api/webhook/tradingview\n\n3) Set the Alert message to JSON. Required fields: secret, email, action (BUY/SELL), entry_price, stop_loss, take_profit.\nExample:\n{\n  "secret": "YOUR_WEBHOOK_SECRET",\n  "email": "your@email.com",\n  "symbol": "BTC/USDT",\n  "action": "BUY",\n  "entry_price": 43000,\n  "stop_loss": 42500,\n  "take_profit": 44000,\n  "timeframe": "15m",\n  "language": "en",\n  "comment": "Signal from TradingView"\n}\n\nNote: the email must match your account email in the app.',
    uk: '1) У Desktop App увімкніть Telegram та/або Email сповіщення в Налаштуваннях і збережіть.\n\n2) У TradingView створіть Alert і увімкніть Webhook URL.\nWebhook URL: https://cryptoanalyz.net/api/webhook/tradingview\n\n3) У полі Message вставте JSON. Обов’язкові поля: secret, email, action (BUY/SELL), entry_price, stop_loss, take_profit.\nПриклад:\n{\n  "secret": "YOUR_WEBHOOK_SECRET",\n  "email": "your@email.com",\n  "symbol": "BTC/USDT",\n  "action": "BUY",\n  "entry_price": 43000,\n  "stop_loss": 42500,\n  "take_profit": 44000,\n  "timeframe": "15m",\n  "language": "uk",\n  "comment": "Signal from TradingView"\n}\n\nПримітка: email має збігатися з email вашого акаунта в додатку.',
    ru: '1) В Desktop App включите Telegram и/или Email уведомления в Настройках и сохраните.\n\n2) В TradingView создайте Alert и включите Webhook URL.\nWebhook URL: https://cryptoanalyz.net/api/webhook/tradingview\n\n3) В поле Message вставьте JSON. Обязательные поля: secret, email, action (BUY/SELL), entry_price, stop_loss, take_profit.\nПример:\n{\n  "secret": "YOUR_WEBHOOK_SECRET",\n  "email": "your@email.com",\n  "symbol": "BTC/USDT",\n  "action": "BUY",\n  "entry_price": 43000,\n  "stop_loss": 42500,\n  "take_profit": 44000,\n  "timeframe": "15m",\n  "language": "ru",\n  "comment": "Signal from TradingView"\n}\n\nПримечание: email должен совпадать с email вашего аккаунта в приложении.'
  },
  'faq.desktopApp.q.notificationsTestChanged': {
    en: 'Why did the test notification button change?',
    uk: 'Чому змінилася кнопка тестового повідомлення?',
    ru: 'Что изменилось в кнопке тестового уведомления?'
  },
  'faq.desktopApp.a.notificationsTestChanged': {
    en: 'Previously the test button was Telegram-only. Now the button “Send test message” sends a test message to all enabled channels (Telegram and/or Email).\nIf nothing is enabled, turn on at least one channel in Settings and try again.',
    uk: 'Раніше тестова кнопка працювала лише для Telegram. Тепер кнопка “Відправити тестове повідомлення” надсилає тест у всі увімкнені канали (Telegram та/або Email).\nЯкщо нічого не увімкнено — активуйте хоча б один канал у Налаштуваннях і спробуйте знову.',
    ru: 'Раньше тестовая кнопка была только для Telegram. Теперь кнопка “Отправить тестовое сообщение” отправляет тест во все включённые каналы (Telegram и/или Email).\nЕсли ничего не включено — активируйте хотя бы один канал в Настройках и повторите тест.'
  },
  'faq.desktopApp.q.logs': {
    en: 'Where are logs and reports stored?',
    uk: 'Де зберігаються логи та звіти?',
    ru: 'Где хранятся логи и отчёты?'
  },
  'faq.desktopApp.a.logs': {
    en: 'The app can show analysis history and logs inside the interface. If you need a specific export, use the report/export options available in the app.',
    uk: 'Додаток показує історію аналізів і логи в інтерфейсі. Якщо потрібен експорт — використовуйте опції звіту/експорту всередині додатку.',
    ru: 'Приложение показывает историю анализов и логи в интерфейсе. Если нужен экспорт — используйте опции отчёта/экспорта внутри приложения.'
  },
  'faq.desktopApp.q.demo': {
    en: 'Is there a demo mode?',
    uk: 'Чи є демо-режим?',
    ru: 'Есть ли демо-режим?'
  },
  'faq.desktopApp.a.demo': {
    en: 'Yes. You can try a demo to see the interface and workflow before purchasing a plan.',
    uk: 'Так. Ви можете спробувати демо, щоб побачити інтерфейс і процес роботи перед покупкою.',
    ru: 'Да. Вы можете попробовать демо, чтобы увидеть интерфейс и процесс работы перед покупкой.'
  },
  'faq.general.title': {
    en: 'General',
    uk: 'Загальні',
    ru: 'Общие'
  },
  'faq.general.subtitle': {
    en: 'Account, security, and data.',
    uk: 'Акаунт, безпека та дані.',
    ru: 'Аккаунт, безопасность и данные.'
  },
  'faq.general.q.security': {
    en: 'How do you keep my account secure?',
    uk: 'Як ви забезпечуєте безпеку акаунта?',
    ru: 'Как вы обеспечиваете безопасность аккаунта?'
  },
  'faq.general.a.security': {
    en: 'Use a strong password and enable email verification. Never share your credentials. We do not ask for your private keys or exchange passwords.',
    uk: 'Використовуйте надійний пароль і підтверджуйте email. Ніколи не передавайте свої дані. Ми не просимо приватні ключі або паролі від бірж.',
    ru: 'Используйте сложный пароль и подтверждайте email. Никому не передавайте данные. Мы не просим приватные ключи или пароли от бирж.'
  },
  'faq.general.q.deleteAccount': {
    en: 'How does the 7-day trial work?',
    uk: 'Як працює 7-денний trial?',
    ru: 'Как работает 7-дневный trial?'
  },
  'faq.general.a.deleteAccount': {
    en: 'After registration you get full access to all features for 7 days. No card required. When the trial ends, Auto-Signals will be locked on the Free plan until you upgrade.',
    uk: 'Після реєстрації ви отримуєте повний доступ до всіх функцій на 7 днів. Картка не потрібна. Після завершення trial автосигнали будуть заблоковані на Free-плані до апгрейду.',
    ru: 'После регистрации вы получаете полный доступ ко всем функциям на 7 дней. Карта не нужна. После завершения trial автосигналы будут заблокированы на Free-плане до апгрейда.'
  },

  'dashboard.deleteAccount': {
    en: 'Delete Account',
    uk: 'Видалити акаунт',
    ru: 'Удалить аккаунт'
  },
  'dashboard.deleteAccountDesc': {
    en: 'This action is irreversible. Your account and data will be deleted.',
    uk: 'Цю дію неможливо скасувати. Ваш акаунт і дані будуть видалені.',
    ru: 'Это действие нельзя отменить. Ваш аккаунт и данные будут удалены.'
  },
  'dashboard.deleteAccountPassword': {
    en: 'Password',
    uk: 'Пароль',
    ru: 'Пароль'
  },
  'dashboard.deleteAccountConfirm': {
    en: 'Confirm deletion',
    uk: 'Підтвердити видалення',
    ru: 'Подтвердить удаление'
  },
  'dashboard.deleteAccountCancel': {
    en: 'Cancel',
    uk: 'Скасувати',
    ru: 'Отмена'
  },
  'dashboard.deleteAccountDeleted': {
    en: 'Account deleted',
    uk: 'Акаунт видалено',
    ru: 'Аккаунт удалён'
  },
  'dashboard.deleteAccountFailed': {
    en: 'Failed to delete account',
    uk: 'Не вдалося видалити акаунт',
    ru: 'Не удалось удалить аккаунт'
  },
  'dashboard.deleteAccountInvalidPassword': {
    en: 'Invalid password',
    uk: 'Невірний пароль',
    ru: 'Неверный пароль'
  },
  'learnMore.trading.title': {
    en: 'Crypto Trading Analyzer',
    uk: 'Crypto Trading Analyzer',
    ru: 'Crypto Trading Analyzer'
  },
  'learnMore.trading.description': {
    en: 'A desktop app for technical analysis and signal generation. Choose a currency pair, trading type (scalping/day trading/swing), strategy and confirmations — and get a structured report with suggested levels and clear logic behind the signal.',
    uk: 'Десктоп-додаток для технічного аналізу та генерації сигналів. Обирай валютну пару, тип торгівлі (скальпінг/дейтрейдинг/свінг), стратегію та підтвердження — і отримуй структурований звіт з рівнями та логікою сигналу.',
    ru: 'Десктоп-приложение для технического анализа и генерации сигналов. Выбирай валютную пару, тип торговли (скальпинг/дейтрейдинг/свинг), стратегию и подтверждения — и получай структурированный отчёт с уровнями и логикой сигнала.'
  },
  'learnMore.trading.description2': {
    en: 'Beginner mode helps you start in a couple of clicks, while Advanced mode gives full control over risk, timeframes, confirmations and additional tools (real-time chart, exports, statistics).',
    uk: 'Режим новачка дозволяє стартувати у кілька кліків, а розширений режим дає повний контроль над ризиком, таймфреймами, підтвердженнями та додатковими інструментами (real-time графік, експорт, статистика).',
    ru: 'Режим новичка позволяет стартовать в пару кликов, а расширенный режим даёт полный контроль над риском, таймфреймами, подтверждениями и дополнительными инструментами (real-time график, экспорт, статистика).'
  },
  'learnMore.trading.indicatorsCount': {
    en: 'You get 15+ built-in indicators (and the set will grow).',
    uk: 'Ви отримуєте 15+ вбудованих індикаторів (і набір буде розширюватися).',
    ru: 'Вы получаете 15+ встроенных индикаторов (и набор будет расширяться).'
  },

  'learnMore.advanced.title': {
    en: 'Advanced Settings',
    uk: 'Розширені налаштування',
    ru: 'Продвинутые настройки'
  },
  'learnMore.advanced.description': {
    en: 'Fine-tune the analysis to match your trading style and market conditions. These options are designed to make signals more consistent and your risk management more controlled.',
    uk: 'Точно налаштуй аналіз під свій стиль торгівлі та ринкові умови. Опції зроблені для стабільніших сигналів та контрольованішого ризику.',
    ru: 'Точно настрой анализ под свой стиль торговли и рыночные условия. Опции сделаны для более стабильных сигналов и более контролируемого риска.'
  },
  'learnMore.advanced.bullet1': {
    en: 'Minimum Signal Reliability (%) — filter out weak setups.',
    uk: 'Мінімальний рейтинг сигналу (%) — відсікає слабкі сетапи.',
    ru: 'Минимальный рейтинг сигнала (%) — отсекает слабые сетапы.'
  },
  'learnMore.advanced.bullet2': {
    en: 'Forecast based on history — helps you see probability context.',
    uk: 'Прогноз на основі історії — додає контекст ймовірностей.',
    ru: 'Прогноз на основе истории — добавляет контекст вероятностей.'
  },
  'learnMore.advanced.bullet3': {
    en: 'Strategy backtesting + backtest period — check how the chosen rules behaved before.',
    uk: 'Бектестинг стратегії + період бектесту — перевір, як правила працювали раніше.',
    ru: 'Бэктестинг стратегии + период бэктеста — проверь, как правила работали раньше.'
  },
  'learnMore.advanced.bullet4': {
    en: 'ML success probability — an additional confidence layer for the signal.',
    uk: 'ML-ймовірність успіху — додатковий шар впевненості в сигналі.',
    ru: 'ML-вероятность успеха — дополнительный слой уверенности в сигнале.'
  },
  'learnMore.advanced.bullet5': {
    en: 'Trailing stop + trailing percent — dynamic risk control for trends.',
    uk: 'Трейлінг-стоп + відсоток трейлінга — динамічний контроль ризику в тренді.',
    ru: 'Трейлинг-стоп + процент трейлинга — динамический контроль риска в тренде.'
  },
  'learnMore.advanced.bullet6': {
    en: 'Auto-select indicators (Smart Combine) — suggests optimal confirmations for current market mode.',
    uk: 'Автопідбір індикаторів (Smart Combine) — підказує оптимальні підтвердження під режим ринку.',
    ru: 'Автоподбор индикаторов (Smart Combine) — подсказывает оптимальные подтверждения под режим рынка.'
  },

  'learnMore.analysis.title': {
    en: 'Strategy Analysis & Heatmap',
    uk: 'Аналіз стратегій та Heatmap',
    ru: 'Анализ стратегий и Heatmap'
  },
  'learnMore.analysis.description': {
    en: 'After the analysis, the app can build a deeper view of results and compare different approaches. It helps you understand which strategy performs better and under what conditions.',
    uk: 'Після аналізу додаток може побудувати глибший розбір результатів і порівняти підходи. Це допомагає зрозуміти, яка стратегія краща і за яких умов.',
    ru: 'После анализа приложение может построить более глубокий разбор результатов и сравнить подходы. Это помогает понять, какая стратегия лучше и при каких условиях.'
  },
  'learnMore.analysis.bullet1': {
    en: 'Auto Report — a quick summary in human-readable form.',
    uk: 'Auto Report — короткий зрозумілий підсумок.',
    ru: 'Auto Report — краткое понятное резюме.'
  },
  'learnMore.analysis.bullet2': {
    en: 'Strategy Comparison — table with win rate, average profit and total performance.',
    uk: 'Порівняння стратегій — таблиця з win rate, середнім прибутком та загальним результатом.',
    ru: 'Сравнение стратегий — таблица с win rate, средней прибылью и общим результатом.'
  },
  'learnMore.analysis.bullet3': {
    en: 'Benchmark: Strategy vs “Buy & Hold” — see if rules beat passive holding.',
    uk: 'Benchmark: стратегія vs “Buy & Hold” — чи кращі правила за пасивне утримання.',
    ru: 'Benchmark: стратегия vs “Buy & Hold” — обгоняют ли правила пассивное удержание.'
  },
  'learnMore.analysis.bullet4': {
    en: 'Heatmap — profitability by time and instruments to spot the best conditions.',
    uk: 'Heatmap — прибутковість за часом та інструментами, щоб бачити найкращі умови.',
    ru: 'Heatmap — прибыльность по времени и инструментам, чтобы видеть лучшие условия.'
  },
  'learnMore.trading.feature1.title': {
    en: 'Indicators and confirmations',
    uk: 'Індикатори та підтвердження',
    ru: 'Индикаторы и подтверждения'
  },
  'learnMore.trading.feature1.text': {
    en: 'RSI, MACD, EMA, Bollinger Bands, ADX, VWMA and combined confirmations. Flexible settings for different market regimes.',
    uk: 'RSI, MACD, EMA, смуги Боллінджера, ADX, VWMA та комбіновані підтвердження. Гнучкі налаштування для різних режимів ринку.',
    ru: 'RSI, MACD, EMA, полосы Боллинджера, ADX, VWMA и комбинированные подтверждения. Гибкие настройки под разные режимы рынка.'
  },
  'learnMore.trading.feature2.title': {
    en: 'Chart with entry/exit marks',
    uk: 'Графік з точками входу/виходу',
    ru: 'График с точками входа/выхода'
  },
  'learnMore.trading.feature2.text': {
    en: 'For convenience, the chart highlights suggested entry/exit points and key levels so you can read the signal faster.',
    uk: 'Для зручності графік підсвічує рекомендовані точки входу/виходу та ключові рівні, щоб сигнал читався швидше.',
    ru: 'Для удобства график подсвечивает рекомендованные точки входа/выхода и ключевые уровни, чтобы сигнал читался быстрее.'
  },
  'learnMore.trading.feature3.title': {
    en: 'Beginner mode',
    uk: 'Режим новачка',
    ru: 'Режим новичка'
  },
  'learnMore.trading.feature3.text': {
    en: 'A simplified interface with minimal required inputs. Switch to advanced mode anytime for deeper control.',
    uk: 'Спрощений інтерфейс з мінімумом потрібних полів. У будь-який момент можна перейти у розширений режим.',
    ru: 'Упрощенный интерфейс с минимальным набором полей. В любой момент можно переключиться на расширенный режим.'
  },
  'learnMore.trading.feature4.title': {
    en: 'Notifications (Telegram & Email)',
    uk: 'Сповіщення (Telegram та Email)',
    ru: 'Уведомления (Telegram и Email)'
  },
  'learnMore.trading.feature4.text': {
    en: 'Configure alerts so you don’t miss signals. Useful when you can’t watch charts all day.',
    uk: 'Налаштуйте сповіщення, щоб не пропускати сигнали. Зручно, коли немає можливості постійно дивитися графіки.',
    ru: 'Настраивайте уведомления, чтобы не пропускать сигналы. Удобно, когда нет возможности постоянно смотреть графики.'
  },
  'learnMore.trading.feature5.title': {
    en: 'Auto-signals & automation',
    uk: 'Автосигнали та автоматизація',
    ru: 'Автосигналы и автоматизация'
  },
  'learnMore.trading.feature5.text': {
    en: 'Set rules for auto-signals and how strict confirmations should be. The goal is consistent decision-making and less emotional trading.',
    uk: 'Задайте правила автосигналів і жорсткість підтверджень. Мета — стабільні рішення та менше емоцій у торгівлі.',
    ru: 'Задайте правила автосигналов и жесткость подтверждений. Цель — стабильные решения и меньше эмоций в торговле.'
  },
  'learnMore.arbitrage.title': {
    en: 'Arbitrage App (Coming Soon)',
    uk: 'Додаток для Арбітражу (Незабаром)',
    ru: 'Приложение для арбитража (скоро)'
  },
  'learnMore.arbitrage.description': {
    en: 'We are preparing a second product focused on arbitrage opportunities across exchanges. It will help detect spreads, estimate fees, and notify you instantly.',
    uk: 'Ми готуємо другий продукт для пошуку арбітражних можливостей між біржами. Він допоможе знаходити спреди, оцінювати комісії та миттєво повідомляти про можливості.',
    ru: 'Мы готовим второй продукт для поиска арбитражных возможностей между биржами. Он поможет находить спреды, оценивать комиссии и мгновенно уведомлять о возможностях.'
  },
  'learnMore.arbitrage.bullet1': {
    en: 'Multi-exchange price scanner and spread ranking',
    uk: 'Сканер цін по кількох біржах та рейтинг спредів',
    ru: 'Сканер цен по нескольким биржам и рейтинг спредов'
  },
  'learnMore.arbitrage.bullet2': {
    en: 'Fee-aware profit estimation and risk filters',
    uk: 'Оцінка прибутку з урахуванням комісій та фільтри ризику',
    ru: 'Оценка прибыли с учетом комиссий и фильтры риска'
  },
  'learnMore.arbitrage.bullet3': {
    en: 'Instant alerts (Telegram/Email) for top opportunities',
    uk: 'Миттєві сповіщення (Telegram/Email) про найкращі можливості',
    ru: 'Мгновенные уведомления (Telegram/Email) о лучших возможностях'
  },
  'learnMore.screens.title': {
    en: 'Screenshots (optional)',
    uk: 'Скріншоти (опційно)',
    ru: 'Скриншоты (необязательно)'
  },
  'learnMore.screens.subtitle': {
    en: 'If you send screenshots, we will place them here to visually explain key features.',
    uk: 'Якщо ви надішлете скріншоти — ми розмістимо їх тут, щоб наочно показати ключові можливості.',
    ru: 'Если ты пришлёшь скриншоты — мы разместим их здесь, чтобы наглядно показать ключевые возможности.'
  },
  'learnMore.screens.shot1': {
    en: 'Beginner mode: quick setup & analysis',
    uk: 'Режим новачка: швидке налаштування та аналіз',
    ru: 'Режим новичка: быстрые настройки и анализ'
  },
  'learnMore.screens.shot2': {
    en: 'Advanced mode: full control of settings',
    uk: 'Розширений режим: повний контроль налаштувань',
    ru: 'Расширенный режим: полный контроль настроек'
  },
  'learnMore.screens.shot3': {
    en: 'Automatic Signals settings',
    uk: 'Налаштування автосигналів',
    ru: 'Настройки автосигналов'
  },
  'learnMore.screens.shot4': {
    en: 'Real-time chart & key levels',
    uk: 'Графік у реальному часі та ключові рівні',
    ru: 'График в реальном времени и ключевые уровни'
  },
  'autoSignals.title': {
    en: 'Automatic Signals',
    uk: 'Автосигнали',
    ru: 'Автосигналы'
  },
  'autoSignals.subtitle': {
    en: 'Settings, test run, and latest logs.',
    uk: 'Налаштування, тест і останні логи.',
    ru: 'Настройки, тест и последние логи.'
  },
  'autoSignals.enabled': {
    en: 'Enabled',
    uk: 'Увімкнено',
    ru: 'Включено'
  },
  'autoSignals.upgradeToPro': {
    en: 'Upgrade to Pro',
    uk: 'Перейдіть на Pro версію',
    ru: 'Перейдите на Pro версию'
  },
  'autoSignals.disabled': {
    en: 'Disabled',
    uk: 'Вимкнено',
    ru: 'Выключено'
  },
  'autoSignals.toggleTitle': {
    en: 'Auto signals',
    uk: 'Автосигнали',
    ru: 'Автосигналы'
  },
  'autoSignals.toggleHint': {
    en: 'Enable or disable automatic signal generation.',
    uk: 'Увімкнути або вимкнути автоматичну генерацію сигналів.',
    ru: 'Включить или выключить автоматическую генерацию сигналов.'
  },
  'autoSignals.lastCheck': {
    en: 'Last check',
    uk: 'Остання перевірка',
    ru: 'Последняя проверка'
  },
  'autoSignals.nextCheck': {
    en: 'Next check',
    uk: 'Наступна перевірка',
    ru: 'Следующая проверка'
  },
  'autoSignals.nextCheckIn': {
    en: 'In',
    uk: 'Через',
    ru: 'Через'
  },
  'autoSignals.skip.interval': {
    en: 'Interval (too early)',
    uk: 'Інтервал (ще рано)',
    ru: 'Интервал (слишком рано)'
  },
  'autoSignals.skip.empty_symbol': {
    en: 'Empty symbol',
    uk: 'Порожній символ',
    ru: 'Пустой символ'
  },
  'autoSignals.skip.insufficient_bars': {
    en: 'Not enough data',
    uk: 'Недостатньо даних',
    ru: 'Недостаточно данных'
  },
  'autoSignals.skip.min_reliability': {
    en: 'Low reliability',
    uk: 'Низька надійність',
    ru: 'Низкая надежность'
  },
  'autoSignals.skip.cooldown': {
    en: 'Cooldown',
    uk: 'Кулдаун',
    ru: 'Кулдаун'
  },
  'autoSignals.skip.dedupe': {
    en: 'Duplicate (already fired)',
    uk: 'Дублікат (вже було)',
    ru: 'Дубликат (уже было)'
  },
  'autoSignals.pairTitle': {
    en: 'Currency pair',
    uk: 'Валютна пара',
    ru: 'Валютная пара'
  },
  'autoSignals.customPair': {
    en: 'Custom pair (with /)',
    uk: 'Своя пара (через /)',
    ru: 'Своя пара (через /)'
  },
  'autoSignals.customPairPlaceholder': {
    en: 'ETH/USDT',
    uk: 'ETH/USDT',
    ru: 'ETH/USDT'
  },
  'autoSignals.tradingTypeTitle': {
    en: 'Trading type',
    uk: 'Тип торгівлі',
    ru: 'Тип торговли'
  },
  'autoSignals.tradingTypeInfo': {
    en: 'Affects the chart timeframe and how often the system checks the market. Also affects how wide stop-loss / take-profit levels are calculated.',
    uk: 'Впливає на таймфрейм графіка та частоту перевірок. Також впливає на розрахунок ширини stop-loss / take-profit.',
    ru: 'Влияет на таймфрейм графика и частоту проверок. Также влияет на расчет ширины stop-loss / take-profit.'
  },
  'autoSignals.tradingType.scalping': {
    en: 'Scalping',
    uk: 'Скальпінг',
    ru: 'Скальпинг'
  },
  'autoSignals.tradingType.dayTrading': {
    en: 'Day trading',
    uk: 'Дейтрейдинг',
    ru: 'Дейтрейдинг'
  },
  'autoSignals.tradingType.swing': {
    en: 'Swing',
    uk: 'Свінг',
    ru: 'Свинг'
  },
  'autoSignals.tradingType.medium': {
    en: 'Mid-term',
    uk: 'Середньострокова',
    ru: 'Среднесрочная'
  },
  'autoSignals.tradingType.long': {
    en: 'Long-term',
    uk: 'Довгострокова',
    ru: 'Долгосрочная'
  },
  'autoSignals.strategyTitle': {
    en: 'Strategy',
    uk: 'Стратегія',
    ru: 'Стратегия'
  },
  'autoSignals.strategyInfo': {
    en: 'Affects the trade plan: entry method (EMA/price), stop-loss / take-profit distances (ATR-based) and position sizing. It does not change the signal direction itself.',
    uk: 'Впливає на торговий план: метод входу (EMA/ціна), дистанції stop-loss / take-profit (на основі ATR) та розмір позиції. Не змінює напрям сигналу.',
    ru: 'Влияет на торговый план: метод входа (EMA/цена), дистанции stop-loss / take-profit (на основе ATR) и размер позиции. Не меняет направление сигнала.'
  },
  'autoSignals.strategy.conservative': {
    en: 'Conservative',
    uk: 'Консервативна',
    ru: 'Консервативная'
  },
  'autoSignals.strategy.balanced': {
    en: 'Balanced',
    uk: 'Збалансована',
    ru: 'Сбалансированная'
  },
  'autoSignals.strategy.aggressive': {
    en: 'Aggressive',
    uk: 'Агресивна',
    ru: 'Агрессивная'
  },
  'autoSignals.capital': {
    en: 'Capital (USD)',
    uk: 'Капітал (USD)',
    ru: 'Капитал (USD)'
  },
  'autoSignals.risk': {
    en: 'Risk (%)',
    uk: 'Ризик (%)',
    ru: 'Риск (%)'
  },
  'autoSignals.minReliability': {
    en: 'Min reliability (%)',
    uk: 'Мін. надійність (%)',
    ru: 'Мин. надежность (%)'
  },
  'autoSignals.checkInterval': {
    en: 'Check interval (min)',
    uk: 'Інтервал перевірки (хв)',
    ru: 'Интервал проверки (мин)'
  },
  'autoSignals.confirmationTitle': {
    en: 'Confirmation',
    uk: 'Підтвердження',
    ru: 'Подтверждения'
  },
  'autoSignals.confirmation.none': {
    en: 'None',
    uk: 'Немає',
    ru: 'Нет'
  },
  'autoSignals.confirmation.all': {
    en: 'All',
    uk: 'Усі',
    ru: 'Все'
  },
  'autoSignals.custom': {
    en: 'Custom',
    uk: 'Свої',
    ru: 'Свои'
  },
  'autoSignals.confirmationSavedAs': {
    en: 'Saved as:',
    uk: 'Збережеться як:',
    ru: 'Сохранится как:'
  },
  'autoSignals.notificationsTitle': {
    en: 'Notifications',
    uk: 'Сповіщення',
    ru: 'Уведомления'
  },
  'autoSignals.logsShowMore': {
    en: 'Show more',
    uk: 'Показати більше',
    ru: 'Показать еще'
  },
  'autoSignals.logsShowLess': {
    en: 'Show less',
    uk: 'Показати менше',
    ru: 'Показать меньше'
  },
  'autoSignals.email': {
    en: 'Email',
    uk: 'Email',
    ru: 'Email'
  },
  'autoSignals.emailHint': {
    en: 'Send an email when a signal is fired',
    uk: 'Надсилати лист при сигналі',
    ru: 'Отправлять письмо при сигнале'
  },
  'autoSignals.telegram': {
    en: 'Telegram',
    uk: 'Telegram',
    ru: 'Telegram'
  },
  'autoSignals.telegramHint': {
    en: 'Send to Telegram when a signal is fired',
    uk: 'Надсилати в Telegram при сигналі',
    ru: 'Отправлять в Telegram при сигнале'
  },
  'autoSignals.telegramChatId': {
    en: 'Telegram chat id',
    uk: 'Telegram chat id',
    ru: 'Telegram chat id'
  },
  'autoSignals.logsTitle': {
    en: 'Latest logs',
    uk: 'Останні логи',
    ru: 'Последние логи'
  },
  'autoSignals.table.id': {
    en: 'ID',
    uk: 'ID',
    ru: 'ID'
  },
  'autoSignals.table.symbol': {
    en: 'Symbol',
    uk: 'Пара',
    ru: 'Пара'
  },
  'autoSignals.table.tf': {
    en: 'TF',
    uk: 'TF',
    ru: 'TF'
  },
  'autoSignals.table.status': {
    en: 'Status',
    uk: 'Статус',
    ru: 'Статус'
  },
  'autoSignals.table.rel': {
    en: 'Rel',
    uk: 'Над.',
    ru: 'Над.'
  },
  'autoSignals.table.created': {
    en: 'Created',
    uk: 'Створено',
    ru: 'Создано'
  },
  'autoSignals.status.fired': {
    en: 'fired',
    uk: 'спрацювало',
    ru: 'сработало'
  },
  'autoSignals.status.skipped': {
    en: 'skipped',
    uk: 'пропущено',
    ru: 'пропущено'
  },
  'autoSignals.status.error': {
    en: 'error',
    uk: 'помилка',
    ru: 'ошибка'
  },
  'autoSignals.logTitle': {
    en: 'Log',
    uk: 'Лог',
    ru: 'Лог'
  },
  'autoSignals.error': {
    en: 'Error',
    uk: 'Помилка',
    ru: 'Ошибка'
  },
  'autoSignals.message': {
    en: 'Message',
    uk: 'Повідомлення',
    ru: 'Сообщение'
  },
  'autoSignals.meta': {
    en: 'Meta',
    uk: 'Meta',
    ru: 'Meta'
  },
  'autoSignals.loading': {
    en: 'Loading...',
    uk: 'Завантаження...',
    ru: 'Загрузка...'
  },
  'autoSignals.noLogs': {
    en: 'No logs',
    uk: 'Немає логів',
    ru: 'Нет логов'
  },
  'autoSignals.save': {
    en: 'Save',
    uk: 'Зберегти',
    ru: 'Сохранить'
  },
  'autoSignals.saving': {
    en: 'Saving...',
    uk: 'Збереження...',
    ru: 'Сохранение...'
  },
  'autoSignals.test': {
    en: 'Test',
    uk: 'Тест',
    ru: 'Тест'
  },
  'autoSignals.testing': {
    en: 'Testing...',
    uk: 'Тестування...',
    ru: 'Тестирование...'
  },
  'autoSignals.testOutput': {
    en: 'Test output',
    uk: 'Вивід тесту',
    ru: 'Вывод теста'
  },
  'autoSignals.toast.saved': {
    en: 'Saved',
    uk: 'Збережено',
    ru: 'Сохранено'
  },
  'autoSignals.toast.saveError': {
    en: 'Save error',
    uk: 'Помилка збереження',
    ru: 'Ошибка сохранения'
  },
  'autoSignals.toast.testDone': {
    en: 'Test completed',
    uk: 'Тест виконано',
    ru: 'Тест выполнен'
  },
  'autoSignals.toast.testError': {
    en: 'Test error',
    uk: 'Помилка тесту',
    ru: 'Ошибка теста'
  },
  'trading.badge': {
    en: 'Product 1',
    uk: 'Продукт 1',
    ru: 'Продукт 1'
  },
  'trading.title': {
    en: 'Trading Analyzer',
    uk: 'Торговий Аналізатор',
    ru: 'Торговый Анализатор'
  },
  'trading.description': {
    en: 'Professional-grade trading analysis tool that combines technical indicators, market data, and AI insights to help you make informed trading decisions.',
    uk: 'Професійний інструмент торгового аналізу, який поєднує технічні індикатори, ринкові дані та AI для прийняття обґрунтованих торгових рішень.',
    ru: 'Профессиональный инструмент торгового анализа, который объединяет технические индикаторы, рыночные данные и AI для принятия обоснованных торговых решений.'
  },
  'trading.feature1.title': {
    en: 'Real-Time Market Analysis',
    uk: 'Аналіз Ринку в Реальному Часі',
    ru: 'Анализ Рынка в Реальном Времени'
  },
  'trading.feature1.description': {
    en: 'Get instant insights with live data from major exchanges and advanced charting tools',
    uk: 'Отримуйте миттєві інсайти з актуальними даними з основних бірж та передовими графічними інструментами',
    ru: 'Получайте мгновенные инсайты с актуальными данными с основных бирж и передовыми графическими инструментами'
  },
  'trading.feature2.title': {
    en: 'Technical Indicators',
    uk: 'Технічні Індикатори',
    ru: 'Технические Индикаторы'
  },
  'trading.feature2.description': {
    en: 'Access 15+ built-in indicators including RSI, MACD, Bollinger Bands, and more',
    uk: 'Доступ до 15+ вбудованих індикаторів, включаючи RSI, MACD, смуги Боллінджера та інші',
    ru: 'Доступ к 15+ встроенным индикаторам, включая RSI, MACD, полосы Боллинджера и другие'
  },
  'trading.feature3.title': {
    en: 'AI-Powered Signals',
    uk: 'Сигнали на основі AI',
    ru: 'Сигналы на основе AI'
  },
  'trading.feature3.description': {
    en: 'Machine learning algorithms analyze patterns and generate buy/sell signals',
    uk: 'Алгоритми машинного навчання аналізують патерни та генерують сигнали купівлі/продажу',
    ru: 'Алгоритмы машинного обучения анализируют паттерны и генерируют сигналы покупки/продажи'
  },
  'trading.feature4.title': {
    en: 'Portfolio Tracking',
    uk: 'Відстеження Портфеля',
    ru: 'Отслеживание Портфеля'
  },
  'trading.feature4.description': {
    en: 'Monitor your holdings across multiple exchanges in one unified dashboard',
    uk: 'Відстежуйте свої активи на кількох біржах в єдиній панелі',
    ru: 'Отслеживайте свои активы на нескольких биржах в единой панели'
  },
  'trading.downloadButton': {
    en: 'Download Trading Analyzer',
    uk: 'Завантажити Торговий Аналізатор',
    ru: 'Скачать Торговый Анализатор'
  },
  'arbitrage.badge': {
    en: 'Product 2',
    uk: 'Продукт 2',
    ru: 'Продукт 2'
  },
  'arbitrage.title': {
    en: 'Arbitrage Trading Tool',
    uk: 'Інструмент Арбітражної Торгівлі',
    ru: 'Инструмент Арбитражной Торговли'
  },
  'arbitrage.description': {
    en: 'Exploit price differences across multiple exchanges with our advanced arbitrage scanner. Maximize profits with minimal risk through automated detection and execution.',
    uk: 'Використовуйте різницю цін на кількох біржах з нашим передовим сканером арбітражу. Максимізуйте прибуток з мінімальним ризиком через автоматичне виявлення та виконання.',
    ru: 'Используйте разницу цен на нескольких биржах с нашим передовым сканером арбитража. Максимизируйте прибыль с минимальным риском через автоматическое обнаружение и исполнение.'
  },
  'arbitrage.feature1.title': {
    en: 'Multi-Exchange Scanner',
    uk: 'Сканер Кількох Бірж',
    ru: 'Сканер Нескольких Бирж'
  },
  'arbitrage.feature1.description': {
    en: 'Simultaneously monitor prices across 20+ major crypto exchanges',
    uk: 'Одночасно відстежуйте ціни на 20+ основних криптобіржах',
    ru: 'Одновременно отслеживайте цены на 20+ основных криптобиржах'
  },
  'arbitrage.feature2.title': {
    en: 'Opportunity Alerts',
    uk: 'Оповіщення про Можливості',
    ru: 'Оповещения о Возможностях'
  },
  'arbitrage.feature2.description': {
    en: 'Get instant notifications when profitable arbitrage opportunities arise',
    uk: 'Отримуйте миттєві сповіщення про прибуткові арбітражні можливості',
    ru: 'Получайте мгновенные уведомления о прибыльных арбитражных возможностях'
  },
  'arbitrage.feature3.title': {
    en: 'Profit Calculator',
    uk: 'Калькулятор Прибутку',
    ru: 'Калькулятор Прибыли'
  },
  'arbitrage.feature3.description': {
    en: 'Factor in trading fees, withdrawal costs, and slippage for accurate profit estimates',
    uk: 'Враховуйте торгові комісії, витрати на виведення та проковзування для точних оцінок прибутку',
    ru: 'Учитывайте торговые комиссии, расходы на вывод и проскальзывание для точных оценок прибыли'
  },
  'arbitrage.feature4.title': {
    en: 'Automated Execution',
    uk: 'Автоматичне Виконання',
    ru: 'Автоматическое Исполнение'
  },
  'arbitrage.feature4.description': {
    en: 'Execute trades automatically to capitalize on fleeting opportunities',
    uk: 'Виконуйте угоди автоматично, щоб скористатися швидкоплинними можливостями',
    ru: 'Исполняйте сделки автоматически, чтобы воспользоваться быстротечными возможностями'
  },
  'arbitrage.downloadButton': {
    en: 'Download Arbitrage Tool',
    uk: 'Завантажити Інструмент Арбітражу',
    ru: 'Скачать Инструмент Арбитража'
  },
  'stats.title': {
    en: 'Trusted by Traders Worldwide',
    uk: 'Довіряють Трейдери по Всьому Світу',
    ru: 'Доверяют Трейдеры по Всему Миру'
  },
  'stats.description': {
    en: 'Join thousands of successful traders using our tools to enhance their trading strategies',
    uk: 'Приєднуйтесь до тисяч успішних трейдерів, які використовують наші інструменти для покращення торгових стратегій',
    ru: 'Присоединяйтесь к тысячам успешных трейдеров, использующих наши инструменты для улучшения торговых стратегий'
  },
  'stats.activeUsers': {
    en: 'Active Users',
    uk: 'Активних Користувачів',
    ru: 'Активных Пользователей'
  },
  'stats.dailyTrades': {
    en: 'Daily Trades',
    uk: 'Щоденних Угод',
    ru: 'Ежедневных Сделок'
  },
  'stats.tradingVolume': {
    en: 'Trading Volume',
    uk: 'Обсяг Торгівлі',
    ru: 'Объем Торговли'
  },
  'cta.title': {
    en: 'Ready to Start Trading Smarter?',
    uk: 'Готові Розпочати Розумну Торгівлю?',
    ru: 'Готовы Начать Умную Торговлю?'
  },
  'cta.description': {
    en: 'Join thousands of successful traders and take your crypto trading to the next level with our advanced tools',
    uk: 'Приєднуйтесь до тисяч успішних трейдерів та виведіть свою криптоторгівлю на новий рівень з нашими передовими інструментами',
    ru: 'Присоединяйтесь к тысячам успешных трейдеров и выведите свою криптоторговлю на новый уровень с нашими передовыми инструментами'
  },
  'cta.tryDemo': {
    en: 'Try Demo Mode',
    uk: 'Спробувати Демо',
    ru: 'Попробовать Демо'
  },
  'cta.noCard': {
    en: 'No credit card required',
    uk: 'Кредитна картка не потрібна',
    ru: 'Кредитная карта не требуется'
  },
  'cta.freeDemo': {
    en: 'Free demo available',
    uk: 'Безкоштовне демо доступне',
    ru: 'Бесплатное демо доступно'
  },
  'footer.description': {
    en: 'Professional trading tools for the modern crypto trader. Analyze, execute, and profit with confidence.',
    uk: 'Професійні торгові інструменти для сучасного криптотрейдера. Аналізуйте, виконуйте та отримуйте прибуток з впевненістю.',
    ru: 'Профессиональные торговые инструменты для современного криптотрейдера. Анализируйте, исполняйте и получайте прибыль с уверенностью.'
  },
  'footer.quickLinks': {
    en: 'Quick Links',
    uk: 'Швидкі Посилання',
    ru: 'Быстрые Ссылки'
  },
  'footer.contactUs': {
    en: 'Contact Us',
    uk: 'Зв\'яжіться з Нами',
    ru: 'Свяжитесь с Нами'
  },
  'footer.copyright': {
    en: 'All rights reserved.',
    uk: 'Всі права захищені.',
    ru: 'Все права защищены.'
  },
  'footer.privacy': {
    en: 'Privacy Policy',
    uk: 'Політика Конфіденційності',
    ru: 'Политика Конфиденциальности'
  },
  'footer.terms': {
    en: 'Terms of Service',
    uk: 'Умови Використання',
    ru: 'Условия Использования'
  },
  'auth.title': {
    en: 'Access your trading dashboard',
    uk: 'Доступ до вашої панелі',
    ru: 'Доступ к вашей панели'
  },
  'auth.email': {
    en: 'Email',
    uk: 'Електронна Пошта',
    ru: 'Электронная Почта'
  },
  'auth.password': {
    en: 'Password',
    uk: 'Пароль',
    ru: 'Пароль'
  },
  'auth.invalidCredentials': {
    en: 'Incorrect email or password',
    uk: 'Неправильний email або пароль',
    ru: 'Неверный email или пароль'
  },
  'auth.loginFailed': {
    en: 'Failed to sign in',
    uk: 'Не вдалося увійти',
    ru: 'Не удалось войти'
  },
  'auth.loginSuccessDesc': {
    en: 'You have successfully signed in.',
    uk: 'Ви успішно увійшли до акаунта.',
    ru: 'Вы успешно вошли в аккаунт.'
  },
  'auth.registerSuccessDesc': {
    en: 'You have successfully created an account.',
    uk: 'Ви успішно створили акаунт.',
    ru: 'Вы успешно создали аккаунт.'
  },
  'auth.passwordsDoNotMatch': {
    en: 'Passwords do not match',
    uk: 'Паролі не співпадають',
    ru: 'Пароли не совпадают'
  },
  'auth.passwordTooShort': {
    en: 'Password must be at least 6 characters',
    uk: 'Пароль має бути не менше 6 символів',
    ru: 'Пароль должен быть не менее 6 символов'
  },
  'auth.name': {
    en: 'Name (Optional)',
    uk: 'Ім\'я (Опціонально)',
    ru: 'Имя (Опционально)'
  },
  'auth.confirmPassword': {
    en: 'Confirm Password',
    uk: 'Підтвердити Пароль',
    ru: 'Подтвердить Пароль'
  },
  'auth.signingIn': {
    en: 'Signing in...',
    uk: 'Вхід...',
    ru: 'Вход...'
  },
  'auth.signingUp': {
    en: 'Signing up...',
    uk: 'Реєстрація...',
    ru: 'Регистрация...'
  },
  'dashboard.welcome': {
    en: 'Welcome back',
    uk: 'З поверненням',
    ru: 'С возвращением'
  },
  'dashboard.description': {
    en: 'Your trading dashboard is ready. Access powerful tools to analyze markets and execute trades.',
    uk: 'Ваша торгова панель готова. Отримайте доступ до потужних інструментів для аналізу ринків та здійснення угод.',
    ru: 'Ваша торговая панель готова. Получите доступ к мощным инструментам для анализа рынков и совершения сделок.'
  },
  'dashboard.profile': {
    en: 'Profile Information',
    uk: 'Інформація Профілю',
    ru: 'Информация Профиля'
  },
  'dashboard.name': {
    en: 'Name',
    uk: 'Ім\'я',
    ru: 'Имя'
  },
  'dashboard.notSet': {
    en: 'Not set',
    uk: 'Не встановлено',
    ru: 'Не установлено'
  },
  'dashboard.comingSoon': {
    en: 'Coming Soon',
    uk: 'Незабаром',
    ru: 'Скоро'
  },
  'dashboard.tradingDescription': {
    en: 'Advanced technical analysis with real-time market data and AI-powered insights',
    uk: 'Розширений технічний аналіз з даними ринку в реальному часі та інсайтами на основі AI',
    ru: 'Расширенный технический анализ с данными рынка в реальном времени и инсайтами на основе AI'
  },
  'dashboard.arbitrageDescription': {
    en: 'Automatically detect and execute profitable arbitrage opportunities across exchanges',
    uk: 'Автоматично виявляйте та виконуйте прибуткові арбітражні можливості на біржах',
    ru: 'Автоматически обнаруживайте и исполняйте прибыльные арбитражные возможности на биржах'
  },
  'dashboard.launchAnalyzer': {
    en: 'Launch Analyzer',
    uk: 'Запустити Аналізатор',
    ru: 'Запустить Анализатор'
  },
  'dashboard.launchTool': {
    en: 'Launch Tool',
    uk: 'Запустити Інструмент',
    ru: 'Запустить Инструмент'
  },
  'download.title': {
    en: 'Download Our Tools',
    uk: 'Завантажити Наші Інструменти',
    ru: 'Скачать Наши Инструменты'
  },
  'download.description': {
    en: 'Get the latest versions of our professional trading tools. Available for Windows, macOS, and Linux.',
    uk: 'Отримайте останні версії наших професійних торгових інструментів. Доступно для Windows, macOS та Linux.',
    ru: 'Получите последние версии наших профессиональных торговых инструментов. Доступно для Windows, macOS и Linux.'
  },
  'download.tradingDescription': {
    en: 'Professional-grade trading analysis tool with AI-powered insights and real-time market data.',
    uk: 'Професійний інструмент торгового аналізу з інсайтами на основі AI та даними ринку в реальному часі.',
    ru: 'Профессиональный инструмент торгового анализа с инсайтами на основе AI и данными рынка в реальном времени.'
  },
  'download.arbitrageDescription': {
    en: 'Advanced arbitrage scanner that identifies and executes profitable cross-exchange opportunities.',
    uk: 'Розширений сканер арбітражу, який виявляє та виконує прибуткові можливості між біржами.',
    ru: 'Расширенный сканер арбитража, который обнаруживает и исполняет прибыльные возможности между биржами.'
  },
  'download.downloadFor': {
    en: 'Download for:',
    uk: 'Завантажити для:',
    ru: 'Скачать для:'
  },
  'prices.title': {
    en: 'Choose Your Plan',
    uk: 'Оберіть Свій План',
    ru: 'Выберите Свой План'
  },
  'prices.description': {
    en: 'Select the perfect plan for your trading needs',
    uk: 'Оберіть ідеальний план для ваших торгових потреб',
    ru: 'Выберите идеальный план для ваших торговых нужд'
  },
  'prices.free': {
    en: 'Free',
    uk: 'Безкоштовно',
    ru: 'Бесплатно'
  },
  'prices.pro': {
    en: 'Pro',
    uk: 'Pro',
    ru: 'Pro'
  },
  'prices.proPlus': {
    en: 'Pro+',
    uk: 'Pro+',
    ru: 'Pro+'
  },
  'prices.select': {
    en: 'Select Plan',
    uk: 'Обрати',
    ru: 'Выбрать'
  },
  'prices.currentPlan': {
    en: 'Current Plan',
    uk: 'Поточний План',
    ru: 'Текущий План'
  },
  'prices.success': {
    en: 'Plan updated successfully',
    uk: 'План успішно оновлено',
    ru: 'План успешно обновлен'
  },
  'prices.successDesc': {
    en: 'Your plan has been updated',
    uk: 'Ваш план оновлено',
    ru: 'Ваш план обновлен'
  },
  'prices.error': {
    en: 'Error',
    uk: 'Помилка',
    ru: 'Ошибка'
  },
  'prices.errorDesc': {
    en: 'Failed to update plan',
    uk: 'Не вдалося оновити план',
    ru: 'Не удалось обновить план'
  },
  'prices.loginRequired': {
    en: 'Login required',
    uk: 'Потрібен вхід',
    ru: 'Требуется вход'
  },
  'prices.loginRequiredDesc': {
    en: 'Please login to select a plan',
    uk: 'Увійдіть, щоб обрати план',
    ru: 'Войдите, чтобы выбрать план'
  },
  'prices.buyNow': {
    en: 'Buy Now',
    uk: 'Купити Зараз',
    ru: 'Купить Сейчас'
  },
  'prices.discount': {
    en: 'Discount',
    uk: 'Знижка',
    ru: 'Скидка'
  },
  'prices.paymentCreated': {
    en: 'Payment created',
    uk: 'Платіж створено',
    ru: 'Платеж создан'
  },
  'prices.addressCopied': {
    en: 'Address copied',
    uk: 'Адресу скопійовано',
    ru: 'Адрес скопирован'
  },
  'prices.addressCopiedDesc': {
    en: 'Payment address copied to clipboard',
    uk: 'Адресу платежу скопійовано в буфер обміну',
    ru: 'Адрес платежа скопирован в буфер обмена'
  },
  'prices.paymentMethod': {
    en: 'Select Payment Method',
    uk: 'Оберіть Спосіб Оплати',
    ru: 'Выберите Способ Оплаты'
  },
  'prices.paymentMethodDesc': {
    en: 'Choose how you want to pay',
    uk: 'Оберіть спосіб оплати',
    ru: 'Выберите способ оплаты'
  },
  'prices.crypto': {
    en: 'Cryptocurrency',
    uk: 'Криптовалюта',
    ru: 'Криптовалюта'
  },
  'prices.card': {
    en: 'Card',
    uk: 'Карта',
    ru: 'Карта'
  },
  'prices.sendAmount': {
    en: 'Send the specified amount to one of these addresses:',
    uk: 'Надішліть вказану суму на один з цих адрес:',
    ru: 'Отправьте указанную сумму на один из этих адресов:'
  },
  'prices.selectCurrency': {
    en: 'Select cryptocurrency or create payments for all popular currencies',
    uk: 'Оберіть криптовалюту або створіть платежі для всіх популярних валют',
    ru: 'Выберите криптовалюту или создайте платежи для всех популярных валют'
  },
  'prices.creating': {
    en: 'Creating payments...',
    uk: 'Створення платежів...',
    ru: 'Создание платежей...'
  },
  'prices.createPayments': {
    en: 'Create Payment Addresses',
    uk: 'Створити Адреси для Оплати',
    ru: 'Создать Адреса для Оплаты'
  },
  'prices.cardDesc': {
    en: 'Pay with credit or debit card. The payment will be converted to cryptocurrency automatically.',
    uk: 'Оплатіть кредитною або дебетовою карткою. Платіж буде автоматично конвертовано в криптовалюту.',
    ru: 'Оплатите кредитной или дебетовой картой. Платеж будет автоматически конвертирован в криптовалюту.'
  },
  'prices.processing': {
    en: 'Processing...',
    uk: 'Обробка...',
    ru: 'Обработка...'
  },
  'prices.payWithCard': {
    en: 'Pay with Card',
    uk: 'Оплатити Карткою',
    ru: 'Оплатить Картой'
  },
  'prices.free.feature1': {
    en: '7-day trial',
    uk: '7-денний пробний період',
    ru: '7-дневный пробный период'
  },
  'prices.free.feature2': {
    en: 'Basic market analysis',
    uk: 'Базовий аналіз ринку',
    ru: 'Базовый анализ рынка'
  },
  'prices.free.feature3': {
    en: 'Real-Time chart',
    uk: 'Real-Time графік',
    ru: 'Real-Time график'
  },
  'prices.free.feature4': {
    en: 'Basic indicators',
    uk: 'Основні індикатори',
    ru: 'Основные индикаторы'
  },
  'prices.free.feature5': {
    en: 'Entry/exit recommendations',
    uk: 'Рекомендації по входу/виходу',
    ru: 'Рекомендации по входу/выходу'
  },
  'prices.free.feature6': {
    en: 'Download ZIP report',
    uk: 'Скачивання ZIP звіту',
    ru: 'Скачивание ZIP отчета'
  },
  'prices.pro.feature1': {
    en: 'Unlimited analyses per month',
    uk: 'Необмежена кількість аналізів на місяць',
    ru: 'Неограниченное количество анализов в месяц'
  },
  'prices.pro.feature2': {
    en: 'All Free plan features',
    uk: 'Всі функції Free плану',
    ru: 'Все функции Free плана'
  },
  'prices.pro.feature3': {
    en: 'Advanced settings',
    uk: 'Продвинуті налаштування',
    ru: 'Продвинутые настройки'
  },
  'prices.pro.feature4': {
    en: 'Download statistics',
    uk: 'Скачування статистики',
    ru: 'Скачивание статистики'
  },
  'prices.pro.feature5': {
    en: 'Strategy analysis',
    uk: 'Аналіз стратегій',
    ru: 'Анализ стратегий'
  },
  'prices.pro.feature6': {
    en: 'ML-based success probability forecast',
    uk: 'ML-прогноз ймовірності успіху',
    ru: 'ML-прогноз вероятности успеха'
  },
  'prices.pro.feature7': {
    en: 'Strategy backtesting',
    uk: 'Бектестінг стратегій',
    ru: 'Бэктестинг стратегий'
  },
  'prices.pro.feature8': {
    en: 'Forecast based on history',
    uk: 'Прогноз на основі історії',
    ru: 'Прогноз на основе истории'
  },
  'prices.pro.feature9': {
    en: 'Trailing stop',
    uk: 'Трейлінг-стоп',
    ru: 'Трейлинг-стоп'
  },
  'prices.pro.feature10': {
    en: 'Auto-select indicators',
    uk: 'Автопідбір індикаторів',
    ru: 'Автоподбор индикаторов'
  },
  'prices.pro.feature11': {
    en: '15+ technical indicators',
    uk: '15+ технічних індикаторів',
    ru: '15+ технических индикаторов'
  },
  'prices.proPlus.feature1': {
    en: 'All Pro plan features',
    uk: 'Всі функції Pro плану',
    ru: 'Все функции Pro плана'
  },
  'prices.proPlus.feature2': {
    en: 'Arbitrage Tool (new)',
    uk: 'Arbitrage Tool (новий інструмент)',
    ru: 'Arbitrage Tool (новый инструмент)'
  },
  'prices.proPlus.feature3': {
    en: 'Early access to new features',
    uk: 'Ранній доступ до нових функцій',
    ru: 'Ранний доступ к новым функциям'
  },
  'prices.proPlus.feature4': {
    en: 'Priority support',
    uk: 'Пріоритетна підтримка',
    ru: 'Приоритетная поддержка'
  },
  'prices.proPlus.feature5': {
    en: 'Advanced analytics',
    uk: 'Розширена аналітика',
    ru: 'Расширенная аналитика'
  },
  'prices.proPlus.feature6': {
    en: 'Exclusive indicators',
    uk: 'Ексклюзивні індикатори',
    ru: 'Эксклюзивные индикаторы'
  },
  'auth.back': {
    en: 'Back',
    uk: 'Назад',
    ru: 'Назад'
  },
  'auth.signInTitle': {
    en: 'Sign In',
    uk: 'Вхід',
    ru: 'Вход'
  },
  'auth.signUpTitle': {
    en: 'Sign Up',
    uk: 'Реєстрація',
    ru: 'Регистрация'
  },
  'auth.forgotPassword': {
    en: 'Forgot password?',
    uk: 'Забули пароль?',
    ru: 'Забыли пароль?'
  },
  'auth.resetPassword': {
    en: 'Reset Password',
    uk: 'Скинути Пароль',
    ru: 'Сбросить Пароль'
  },
  'auth.resetPasswordDesc': {
    en: 'Enter your email address and we will send you a link to reset your password.',
    uk: 'Введіть вашу адресу електронної пошти, і ми надішлемо вам посилання для скидання пароля.',
    ru: 'Введите ваш адрес электронной почты, и мы отправим вам ссылку для сброса пароля.'
  },
  'auth.resetEmailSent': {
    en: 'Reset email sent',
    uk: 'Лист для скидання пароля надіслано',
    ru: 'Письмо для сброса пароля отправлено'
  },
  'auth.resetEmailSentDesc': {
    en: 'If the email exists, a password reset link has been sent to your email.',
    uk: 'Якщо email існує, посилання для скидання пароля було надіслано на вашу пошту.',
    ru: 'Если email существует, ссылка для сброса пароля была отправлена на вашу почту.'
  },
  'auth.sendResetLink': {
    en: 'Send Reset Link',
    uk: 'Надіслати Посилання',
    ru: 'Отправить Ссылку'
  },
  'auth.sending': {
    en: 'Sending...',
    uk: 'Відправка...',
    ru: 'Отправка...'
  },
  'auth.emailNotVerified': {
    en: 'Email Not Verified',
    uk: 'Email Не Підтверджено',
    ru: 'Email Не Подтвержден'
  },
  'auth.emailNotVerifiedDesc': {
    en: 'Please verify your email address before signing in.',
    uk: 'Будь ласка, підтвердіть вашу адресу електронної пошти перед входом.',
    ru: 'Пожалуйста, подтвердите ваш адрес электронной почты перед входом.'
  },
  'auth.emailNotVerifiedMessage': {
    en: 'Please check your email and click the verification link. If you didn\'t receive the email, you can resend it.',
    uk: 'Будь ласка, перевірте вашу пошту та натисніть на посилання для підтвердження. Якщо ви не отримали лист, ви можете надіслати його знову.',
    ru: 'Пожалуйста, проверьте вашу почту и нажмите на ссылку для подтверждения. Если вы не получили письмо, вы можете отправить его снова.'
  },
  'auth.resendVerification': {
    en: 'Resend Verification Email',
    uk: 'Надіслати Лист Знову',
    ru: 'Отправить Письмо Снова'
  },
  'auth.dismiss': {
    en: 'Dismiss',
    uk: 'Закрити',
    ru: 'Закрыть'
  },
  'auth.verificationEmailSent': {
    en: 'Verification email sent',
    uk: 'Лист для підтвердження надіслано',
    ru: 'Письмо для подтверждения отправлено'
  },
  'auth.verificationEmailSentDesc': {
    en: 'A verification email has been sent to your email address.',
    uk: 'Лист для підтвердження було надіслано на вашу адресу електронної пошти.',
    ru: 'Письмо для подтверждения было отправлено на ваш адрес электронной почты.'
  },
  'auth.accountCreated': {
    en: 'Account created!',
    uk: 'Обліковий запис створено!',
    ru: 'Учетная запись создана!'
  },
  'auth.error': {
    en: 'Error',
    uk: 'Помилка',
    ru: 'Ошибка'
  },
  'auth.passwordMinLength': {
    en: 'Password must be at least 6 characters',
    uk: 'Пароль повинен містити мінімум 6 символів',
    ru: 'Пароль должен содержать минимум 6 символов'
  },
  'auth.resetting': {
    en: 'Resetting...',
    uk: 'Скидання...',
    ru: 'Сброс...'
  },
  'auth.passwordReset': {
    en: 'Password Reset!',
    uk: 'Пароль Скинуто!',
    ru: 'Пароль Сброшен!'
  },
  'auth.passwordResetDesc': {
    en: 'Your password has been successfully reset. You can now login with your new password.',
    uk: 'Ваш пароль успішно скинуто. Тепер ви можете увійти з новим паролем.',
    ru: 'Ваш пароль успешно сброшен. Теперь вы можете войти с новым паролем.'
  },
  'auth.resetError': {
    en: 'Reset Failed',
    uk: 'Помилка Скидання',
    ru: 'Ошибка Сброса'
  },
  'auth.resetErrorDesc': {
    en: 'The reset link is invalid or has expired.',
    uk: 'Посилання для скидання недійсне або застаріле.',
    ru: 'Ссылка для сброса недействительна или устарела.'
  },
  'auth.goToLogin': {
    en: 'Go to Login',
    uk: 'Перейти до Входу',
    ru: 'Перейти ко Входу'
  },
  'auth.backToLogin': {
    en: 'Back to Login',
    uk: 'Назад до Входу',
    ru: 'Назад ко Входу'
  },
  'auth.goToDashboard': {
    en: 'Go to Dashboard',
    uk: 'Перейти до Панелі',
    ru: 'Перейти к Панели'
  },
  'auth.verifyingEmail': {
    en: 'Verifying your email...',
    uk: 'Підтвердження вашої пошти...',
    ru: 'Подтверждение вашей почты...'
  },
  'auth.verifyingEmailDesc': {
    en: 'Please wait while we verify your email address.',
    uk: 'Будь ласка, зачекайте, поки ми підтверджуємо вашу адресу електронної пошти.',
    ru: 'Пожалуйста, подождите, пока мы подтверждаем ваш адрес электронной почты.'
  },
  'auth.emailVerified': {
    en: 'Email Verified!',
    uk: 'Email Підтверджено!',
    ru: 'Email Подтвержден!'
  },
  'auth.emailVerifiedDesc': {
    en: 'Your email has been successfully verified. You can now use all features.',
    uk: 'Ваш email успішно підтверджено. Тепер ви можете використовувати всі функції.',
    ru: 'Ваш email успешно подтвержден. Теперь вы можете использовать все функции.'
  },
  'auth.verificationError': {
    en: 'Verification Failed',
    uk: 'Помилка Підтвердження',
    ru: 'Ошибка Подтверждения'
  },
  'auth.verificationErrorDesc': {
    en: 'The verification link is invalid or has expired.',
    uk: 'Посилання для підтвердження недійсне або застаріле.',
    ru: 'Ссылка для подтверждения недействительна или устарела.'
  },
  'privacy.title': {
    en: 'Privacy Policy',
    uk: 'Політика Конфіденційності',
    ru: 'Политика Конфиденциальности'
  },
  'privacy.section1.title': {
    en: '1. Information We Collect',
    uk: '1. Інформація, Яку Ми Збираємо',
    ru: '1. Информация, Которую Мы Собираем'
  },
  'privacy.section1.text': {
    en: 'We collect information that you provide directly to us, including your email address, password (encrypted), and trading preferences when you register for an account.',
    uk: 'Ми збираємо інформацію, яку ви надаєте нам безпосередньо, включаючи вашу адресу електронної пошти, пароль (зашифрований) та торгові налаштування при реєстрації облікового запису.',
    ru: 'Мы собираем информацию, которую вы предоставляете нам напрямую, включая ваш адрес электронной почты, пароль (зашифрованный) и торговые настройки при регистрации учетной записи.'
  },
  'privacy.section2.title': {
    en: '2. How We Use Your Information',
    uk: '2. Як Ми Використовуємо Вашу Інформацію',
    ru: '2. Как Мы Используем Вашу Информацию'
  },
  'privacy.section2.text': {
    en: 'We use the information we collect to provide, maintain, and improve our services, process transactions, send you technical notices and support messages, and communicate with you.',
    uk: 'Ми використовуємо зібрану інформацію для надання, підтримки та покращення наших послуг, обробки транзакцій, надсилання технічних повідомлень та повідомлень підтримки, а також спілкування з вами.',
    ru: 'Мы используем собранную информацию для предоставления, поддержки и улучшения наших услуг, обработки транзакций, отправки технических уведомлений и сообщений поддержки, а также общения с вами.'
  },
  'privacy.section3.title': {
    en: '3. Data Security',
    uk: '3. Безпека Даних',
    ru: '3. Безопасность Данных'
  },
  'privacy.section3.text': {
    en: 'We implement appropriate security measures to protect your personal information. However, no method of transmission over the Internet is 100% secure.',
    uk: 'Ми впроваджуємо відповідні заходи безпеки для захисту вашої особистої інформації. Однак жоден спосіб передачі через Інтернет не є на 100% безпечним.',
    ru: 'Мы внедряем соответствующие меры безопасности для защиты вашей личной информации. Однако ни один способ передачи через Интернет не является на 100% безопасным.'
  },
  'privacy.section4.title': {
    en: '4. Cookies',
    uk: '4. Файли Cookie',
    ru: '4. Файлы Cookie'
  },
  'privacy.section4.text': {
    en: 'We use cookies to maintain your session and improve your experience. You can control cookies through your browser settings.',
    uk: 'Ми використовуємо файли cookie для підтримки вашої сесії та покращення вашого досвіду. Ви можете керувати файлами cookie через налаштування вашого браузера.',
    ru: 'Мы используем файлы cookie для поддержки вашей сессии и улучшения вашего опыта. Вы можете управлять файлами cookie через настройки вашего браузера.'
  },
  'privacy.section5.title': {
    en: '5. Contact Us',
    uk: '5. Зв\'яжіться з Нами',
    ru: '5. Свяжитесь с Нами'
  },
  'privacy.section5.text': {
    en: 'If you have questions about this Privacy Policy, please contact us at:',
    uk: 'Якщо у вас є питання щодо цієї Політики Конфіденційності, будь ласка, зв\'яжіться з нами:',
    ru: 'Если у вас есть вопросы относительно этой Политики Конфиденциальности, пожалуйста, свяжитесь с нами:'
  },
  'terms.title': {
    en: 'Terms of Service',
    uk: 'Умови Використання',
    ru: 'Условия Использования'
  },
  'terms.section1.title': {
    en: '1. Acceptance of Terms',
    uk: '1. Прийняття Умов',
    ru: '1. Принятие Условий'
  },
  'terms.section1.text': {
    en: 'By accessing and using Cryptoanaliz, you accept and agree to be bound by the terms and provision of this agreement.',
    uk: 'Отримуючи доступ та використовуючи Cryptoanaliz, ви приймаєте та погоджуєтеся дотримуватися умов та положень цієї угоди.',
    ru: 'Получая доступ и используя Cryptoanaliz, вы принимаете и соглашаетесь соблюдать условия и положения этого соглашения.'
  },
  'terms.section2.title': {
    en: '2. Use License',
    uk: '2. Ліцензія на Використання',
    ru: '2. Лицензия на Использование'
  },
  'terms.section2.text': {
    en: 'Permission is granted to temporarily use Cryptoanaliz for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title.',
    uk: 'Дозвіл надається для тимчасового використання Cryptoanaliz лише для особистого, некомерційного перегляду. Це надання ліцензії, а не передача права власності.',
    ru: 'Разрешение предоставляется для временного использования Cryptoanaliz только для личного, некоммерческого просмотра. Это предоставление лицензии, а не передача права собственности.'
  },
  'terms.section3.title': {
    en: '3. Disclaimer',
    uk: '3. Відмова від Відповідальності',
    ru: '3. Отказ от Ответственности'
  },
  'terms.section3.text1': {
    en: 'The materials on Cryptoanaliz are provided on an \'as is\' basis. Cryptoanaliz makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties.',
    uk: 'Матеріали на Cryptoanaliz надаються на основі "як є". Cryptoanaliz не надає жодних гарантій, явних або передбачуваних, і тим самим відмовляється від усіх інших гарантій.',
    ru: 'Материалы на Cryptoanaliz предоставляются на основе "как есть". Cryptoanaliz не предоставляет никаких гарантий, явных или подразумеваемых, и тем самым отказывается от всех других гарантий.'
  },
  'terms.section3.text2': {
    en: 'Trading cryptocurrencies involves substantial risk of loss. Past performance is not indicative of future results. You should not invest more than you can afford to lose.',
    uk: 'Торгівля криптовалютами пов\'язана зі значним ризиком втрат. Минулі результати не є показником майбутніх результатів. Ви не повинні інвестувати більше, ніж можете дозволити собі втратити.',
    ru: 'Торговля криптовалютами связана со значительным риском потерь. Прошлые результаты не являются показателем будущих результатов. Вы не должны инвестировать больше, чем можете позволить себе потерять.'
  },
  'terms.section4.title': {
    en: '4. Limitations',
    uk: '4. Обмеження',
    ru: '4. Ограничения'
  },
  'terms.section4.text': {
    en: 'In no event shall Cryptoanaliz or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on Cryptoanaliz.',
    uk: 'Ні за яких обставин Cryptoanaliz або його постачальники не несуть відповідальності за будь-які збитки (включаючи, без обмежень, збитки від втрати даних або прибутку, або через перерву в бізнесі), що виникають внаслідок використання або неможливості використання матеріалів на Cryptoanaliz.',
    ru: 'Ни при каких обстоятельствах Cryptoanaliz или его поставщики не несут ответственности за любые убытки (включая, без ограничений, убытки от потери данных или прибыли, или из-за перерыва в бизнесе), возникающие в результате использования или невозможности использования материалов на Cryptoanaliz.'
  },
  'terms.section5.title': {
    en: '5. Account Responsibility',
    uk: '5. Відповідальність за Обліковий Запис',
    ru: '5. Ответственность за Учетную Запись'
  },
  'terms.section5.text': {
    en: 'You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account.',
    uk: 'Ви несете відповідальність за збереження конфіденційності вашого облікового запису та пароля. Ви погоджуєтеся прийняти відповідальність за всі дії, що відбуваються під вашим обліковим записом.',
    ru: 'Вы несете ответственность за сохранение конфиденциальности вашей учетной записи и пароля. Вы соглашаетесь принять ответственность за все действия, происходящие под вашей учетной записью.'
  },
  'terms.section6.title': {
    en: '6. Contact Us',
    uk: '6. Зв\'яжіться з Нами',
    ru: '6. Свяжитесь с Нами'
  },
  'terms.section6.text': {
    en: 'If you have questions about these Terms of Service, please contact us at:',
    uk: 'Якщо у вас є питання щодо цих Умов Використання, будь ласка, зв\'яжіться з нами:',
    ru: 'Если у вас есть вопросы относительно этих Условий Использования, пожалуйста, свяжитесь с нами:'
  },
  'privacy.lastUpdated': {
    en: 'Last updated: November 29, 2025',
    uk: 'Останнє оновлення: 29 листопада 2025',
    ru: 'Последнее обновление: 29 ноября 2025'
  },
  'terms.lastUpdated': {
    en: 'Last updated: November 29, 2025',
    uk: 'Останнє оновлення: 29 листопада 2025',
    ru: 'Последнее обновление: 29 ноября 2025'
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    return (saved as Language) || 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };

  const t = (key: string): string => {
    return translations[key]?.[language] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}
