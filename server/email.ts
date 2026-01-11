import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailOptions) {
  // Проверяем наличие необходимых переменных окружения
  const missingVars = [];
  if (!process.env.SMTP_HOST) missingVars.push('SMTP_HOST');
  if (!process.env.SMTP_USER) missingVars.push('SMTP_USER');
  if (!process.env.SMTP_PASS) missingVars.push('SMTP_PASS');
  
  if (missingVars.length > 0) {
    const errorMsg = `SMTP configuration is missing: ${missingVars.join(', ')}`;
    console.error(errorMsg);
    console.error('Current env vars:', {
      SMTP_HOST: process.env.SMTP_HOST || 'NOT SET',
      SMTP_PORT: process.env.SMTP_PORT || 'NOT SET',
      SMTP_USER: process.env.SMTP_USER || 'NOT SET',
      SMTP_PASS: process.env.SMTP_PASS ? '***SET***' : 'NOT SET',
      BASE_URL: process.env.BASE_URL || 'NOT SET',
      SMTP_FROM: process.env.SMTP_FROM || 'NOT SET',
    });
    throw new Error(errorMsg);
  }

  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  if (isNaN(port)) {
    throw new Error(`Invalid SMTP_PORT: ${process.env.SMTP_PORT}`);
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: port,
    secure: port === 465, // true для порта 465, false для других
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    // Дополнительные настройки для Resend
    tls: {
      rejectUnauthorized: false, // Для некоторых SMTP серверов
    },
  });

  try {
    // Для Resend: используйте верифицированный домен или onboarding.resend.com
    // SMTP_USER для Resend обычно "resend", но from должен быть верифицированным email
    const fromEmail = process.env.SMTP_FROM || 'onboarding@resend.dev';
    
    console.log('Attempting to send email:', {
      from: fromEmail,
      to,
      subject,
      host: process.env.SMTP_HOST,
      port: port,
    });
    
    const info = await transporter.sendMail({
      from: `"Crypto Analyzer" <${fromEmail}>`,
      to,
      subject,
      html,
    });

    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email sending failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error code:', (error as any).code);
      console.error('Error response:', (error as any).response);
      console.error('Error command:', (error as any).command);
      console.error('Error stack:', error.stack);
    }
    throw error; // Пробрасываем оригинальную ошибку для более детальной обработки
  }
}

export function generateVerificationEmail(token: string, language: 'en' | 'uk' | 'ru' = 'en') {
  // Убираем слэш в конце BASE_URL, если он есть
  const baseUrl = (process.env.BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
  const verificationUrl = `${baseUrl}/verify-email?token=${token}`;

  const translations = {
    en: {
      subject: 'Verify your email - Crypto Analyzer',
      title: 'Verify Your Email Address',
      text: 'Thank you for registering! Please click the button below to verify your email address.',
      button: 'Verify Email',
      footer: 'If you didn\'t create an account, you can safely ignore this email.',
    },
    uk: {
      subject: 'Підтвердіть email - Crypto Analyzer',
      title: 'Підтвердіть вашу адресу електронної пошти',
      text: 'Дякуємо за реєстрацію! Натисніть кнопку нижче, щоб підтвердити вашу адресу електронної пошти.',
      button: 'Підтвердити Email',
      footer: 'Якщо ви не створювали обліковий запис, ви можете безпечно ігнорувати цей лист.',
    },
    ru: {
      subject: 'Подтвердите email - Crypto Analyzer',
      title: 'Подтвердите ваш адрес электронной почты',
      text: 'Спасибо за регистрацию! Нажмите кнопку ниже, чтобы подтвердить ваш адрес электронной почты.',
      button: 'Подтвердить Email',
      footer: 'Если вы не создавали учетную запись, вы можете безопасно игнорировать это письмо.',
    },
  };

  const t = translations[language];

  return {
    subject: t.subject,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              padding: 40px 20px;
              border-radius: 10px;
              text-align: center;
            }
            .content {
              background: white;
              padding: 30px;
              border-radius: 8px;
              margin: 20px 0;
            }
            h1 {
              color: white;
              margin: 0 0 20px 0;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
              font-weight: bold;
            }
            .footer {
              color: #666;
              font-size: 14px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${t.title}</h1>
            <div class="content">
              <p>${t.text}</p>
              <a href="${verificationUrl}" class="button">${t.button}</a>
              <div class="footer">
                <p>${t.footer}</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
  };
}

export function generatePasswordResetEmail(token: string, language: 'en' | 'uk' | 'ru' = 'en') {
  // Убираем слэш в конце BASE_URL, если он есть
  const baseUrl = (process.env.BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
  const resetUrl = `${baseUrl}/reset-password?token=${token}`;

  const translations = {
    en: {
      subject: 'Reset your password - Crypto Analyzer',
      title: 'Reset Your Password',
      text: 'You requested to reset your password. Click the button below to create a new password.',
      button: 'Reset Password',
      footer: 'If you didn\'t request a password reset, you can safely ignore this email. This link will expire in 1 hour.',
    },
    uk: {
      subject: 'Скиньте пароль - Crypto Analyzer',
      title: 'Скиньте ваш пароль',
      text: 'Ви запросили скидання пароля. Натисніть кнопку нижче, щоб створити новий пароль.',
      button: 'Скинути пароль',
      footer: 'Якщо ви не запитували скидання пароля, ви можете безпечно ігнорувати цей лист. Це посилання дійсне протягом 1 години.',
    },
    ru: {
      subject: 'Сбросьте пароль - Crypto Analyzer',
      title: 'Сбросьте ваш пароль',
      text: 'Вы запросили сброс пароля. Нажмите кнопку ниже, чтобы создать новый пароль.',
      button: 'Сбросить пароль',
      footer: 'Если вы не запрашивали сброс пароля, вы можете безопасно игнорировать это письмо. Эта ссылка действительна в течение 1 часа.',
    },
  };

  const t = translations[language];

  return {
    subject: t.subject,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              padding: 40px 20px;
              border-radius: 10px;
              text-align: center;
            }
            .content {
              background: white;
              padding: 30px;
              border-radius: 8px;
              margin: 20px 0;
            }
            h1 {
              color: white;
              margin: 0 0 20px 0;
            }
            .button {
              display: inline-block;
              padding: 12px 30px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
              font-weight: bold;
            }
            .footer {
              color: #666;
              font-size: 14px;
              margin-top: 20px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>${t.title}</h1>
            <div class="content">
              <p>${t.text}</p>
              <a href="${resetUrl}" class="button">${t.button}</a>
              <div class="footer">
                <p>${t.footer}</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `,
  };
}
