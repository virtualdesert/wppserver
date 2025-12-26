const express = require('express');
const cors = require('cors');
const wppconnect = require('@wppconnect-team/wppconnect');

const app = express();
app.use(cors());
app.use(express.json());

let client = null;
let isReady = false;

// Iniciar cliente WhatsApp
wppconnect
  .create({
    session: 'financeiro',
    catchQR: (base64Qr, asciiQR) => {
      console.log('QR CODE recebido!');
      console.log(asciiQR); // QR no terminal
      qrCode = base64Qr; // Salvar para API
    },
    statusFind: (statusSession, session) => {
      console.log('Status:', statusSession);
      if (statusSession === 'isLogged') {
        isReady = true;
        console.log('WhatsApp conectado! ✅');
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
    console.log('Cliente WPPConnect iniciado!');
  })
  .catch((error) => {
    console.log('Erro:', error);
  });

let qrCode = null;

// Rota para pegar QR Code
app.get('/qr', (req, res) => {
  if (isReady) {
    res.json({ status: 'connected', message: 'WhatsApp já está conectado!' });
  } else if (qrCode) {
    res.json({ status: 'qr_code', qr: qrCode });
  } else {
    res.json({ status: 'starting', message: 'Aguardando QR Code...' });
  }
});

// Rota para verificar status
app.get('/status', (req, res) => {
  res.json({ 
    status: isReady ? 'connected' : 'disconnected',
    ready: isReady 
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

    // Formatar número (remover caracteres especiais)
    const formattedNumber = number.replace(/\D/g, '');
    const chatId = `${formattedNumber}@c.us`;

    await client.sendText(chatId, message);
    
    res.json({ success: true, message: 'Mensagem enviada!' });
  } catch (error) {
    console.error('Erro ao enviar:', error);
    res.status(500).json({ error: error.message });
  }
});

// Receber mensagens
app.post('/webhook', (req, res) => {
  // Webhook para receber mensagens (configuraremos depois)
  res.json({ received: true });
});

const PORT = process.env.PORT || 21465;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`📱 Acesse /qr para ver o QR Code`);
  console.log(`✅ Acesse /status para verificar conexão`);
});
