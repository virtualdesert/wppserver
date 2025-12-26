const express = require('express');
const cors = require('cors');
const wppconnect = require('@wppconnect-team/wppconnect');

const app = express();
app.use(cors());
app.use(express.json());

let client = null;
let isReady = false;
let qrCode = null;

// Iniciar cliente WhatsApp
wppconnect
  .create({
    session: 'financeiro',
    catchQR: (base64Qr, asciiQR) => {
      console.log('========== QR CODE GERADO ==========');
      console.log(asciiQR); // QR no terminal
      console.log('====================================');
      qrCode = base64Qr;
    },
    statusFind: (statusSession, session) => {
      console.log('Status da sessão:', statusSession);
      if (statusSession === 'isLogged') {
        isReady = true;
        qrCode = null; // Limpar QR após conectar
        console.log('✅ WhatsApp conectado com sucesso!');
      }
    },
    headless: true,
    useChrome: false,
    puppeteerOptions: {
      executablePath: '/usr/bin/chromium',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    }
  })
  .then((c) => {
    client = c;
    console.log('✅ Cliente WPPConnect iniciado!');
    
    // Listener para mensagens recebidas
    client.onMessage(async (message) => {
      console.log('📩 Mensagem recebida:', message.body);
    });
  })
  .catch((error) => {
    console.log('❌ Erro ao iniciar:', error);
  });

// Página HTML com QR Code
app.get('/qr', (req, res) => {
  if (isReady) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>WhatsApp Conectado</title>
        <style>
          body { font-family: Arial; text-align: center; padding: 50px; background: #0f172a; color: white; }
          .success { font-size: 48px; margin-bottom: 20px; }
        </style>
      </head>
      <body>
        <div class="success">✅</div>
        <h1>WhatsApp já está conectado!</h1>
        <p>Você pode fechar esta página.</p>
      </body>
      </html>
    `);
  } else if (qrCode) {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Conectar WhatsApp</title>
        <meta http-equiv="refresh" content="10">
        <style>
          body { 
            font-family: Arial; 
            text-align: center; 
            padding: 50px; 
            background: #0f172a; 
            color: white; 
          }
          img { 
            max-width: 400px; 
            border: 10px solid white; 
            border-radius: 20px;
            box-shadow: 0 0 30px rgba(255,255,255,0.3);
          }
          h1 { margin-bottom: 30px; }
          .instructions { 
            max-width: 500px; 
            margin: 30px auto; 
            text-align: left;
            background: rgba(255,255,255,0.1);
            padding: 20px;
            border-radius: 10px;
          }
          .step { margin: 10px 0; }
        </style>
      </head>
      <body>
        <h1>📱 Escaneie o QR Code</h1>
        <img src="${qrCode}" alt="QR Code WhatsApp">
        <div class="instructions">
          <div class="step">1️⃣ Abra o WhatsApp no celular</div>
          <div class="step">2️⃣ Toque em ⋮ → Aparelhos conectados</div>
          <div class="step">3️⃣ Toque em "Conectar aparelho"</div>
          <div class="step">4️⃣ Escaneie este QR Code</div>
        </div>
        <p><small>Esta página atualiza automaticamente a cada 10 segundos</small></p>
      </body>
      </html>
    `);
  } else {
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Aguardando...</title>
        <meta http-equiv="refresh" content="3">
        <style>
          body { 
            font-family: Arial; 
            text-align: center; 
            padding: 50px; 
            background: #0f172a; 
            color: white; 
          }
          .loading { 
            font-size: 48px; 
            animation: pulse 1.5s ease-in-out infinite;
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        </style>
      </head>
      <body>
        <div class="loading">⏳</div>
        <h1>Gerando QR Code...</h1>
        <p>Aguarde alguns segundos...</p>
      </body>
      </html>
    `);
  }
});

// Rota para verificar status (JSON)
app.get('/status', (req, res) => {
  res.json({ 
    status: isReady ? 'connected' : 'disconnected',
    ready: isReady,
    hasQR: qrCode !== null
  });
});

// Rota para enviar mensagem
app.post('/send-message', async (req, res) => {
  try {
    if (!isReady) {
      return res.status(400).json({ error: 'WhatsApp não está conectado' });
    }

    const { number, message } = req.body;
    
    if (!number || !message) {
      return res.status(400).json({ error: 'Número e mensagem são obrigatórios' });
    }

    const formattedNumber = number.replace(/\D/g, '');
    const chatId = `${formattedNumber}@c.us`;

    await client.sendText(chatId, message);
    
    res.json({ success: true, message: 'Mensagem enviada!' });
  } catch (error) {
    console.error('❌ Erro ao enviar:', error);
    res.status(500).json({ error: error.message });
  }
});

// Página inicial
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>WhatsApp Bot Server</title>
      <style>
        body { 
          font-family: Arial; 
          max-width: 600px; 
          margin: 50px auto; 
          padding: 20px;
          background: #0f172a;
          color: white;
        }
        a { 
          display: block; 
          padding: 15px; 
          margin: 10px 0; 
          background: #3b82f6; 
          color: white; 
          text-decoration: none; 
          border-radius: 5px;
          text-align: center;
        }
        a:hover { background: #2563eb; }
      </style>
    </head>
    <body>
      <h1>🤖 WhatsApp Bot Server</h1>
      <p>Status: ${isReady ? '✅ Conectado' : '⏳ Aguardando conexão'}</p>
      <a href="/qr">📱 Ver QR Code / Status</a>
      <a href="/status">📊 Status (JSON)</a>
    </body>
    </html>
  `);
});

const PORT = process.env.PORT || 21465;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📱 Acesse /qr para conectar WhatsApp`);
});
