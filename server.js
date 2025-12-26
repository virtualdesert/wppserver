const express = require('express');
const cors = require('cors');
const makeWASocket = require('@whiskeysockets/baileys').default;
const { DisconnectReason, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');

const app = express();
app.use(cors());
app.use(express.json());

let sock = null;
let qrCodeData = null;
let isConnected = false;

// Logger
const logger = pino({ level: 'silent' });

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger,
        browser: ['Bot Financeiro', 'Chrome', '1.0.0']
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log('📱 QR Code gerado!');
            qrCodeData = await QRCode.toDataURL(qr);
        }
        
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexão fechada. Reconectando...', shouldReconnect);
            isConnected = false;
            qrCodeData = null;
            
            if (shouldReconnect) {
                setTimeout(connectToWhatsApp, 3000);
            }
        } else if (connection === 'open') {
            console.log('✅ WhatsApp conectado com sucesso!');
            isConnected = true;
            qrCodeData = null;
        }
    });

    sock.ev.on('creds.update', saveCreds);
    
    // Receber mensagens
    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        
        console.log('📩 Mensagem recebida:', msg.message);
    });
}

// Iniciar conexão
connectToWhatsApp();

// Página com QR Code
app.get('/qr', (req, res) => {
    if (isConnected) {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>WhatsApp Conectado</title>
                <meta http-equiv="refresh" content="3; url=/">
                <style>
                    body { 
                        font-family: Arial; 
                        text-align: center; 
                        padding: 50px; 
                        background: #0f172a; 
                        color: white; 
                    }
                    .success { font-size: 72px; margin-bottom: 20px; }
                </style>
            </head>
            <body>
                <div class="success">✅</div>
                <h1>WhatsApp Conectado!</h1>
                <p>Redirecionando...</p>
            </body>
            </html>
        `);
    } else if (qrCodeData) {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Conectar WhatsApp</title>
                <meta http-equiv="refresh" content="15">
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
                        background: white;
                        padding: 20px;
                        border-radius: 20px;
                        box-shadow: 0 0 30px rgba(255,255,255,0.3);
                    }
                    .instructions { 
                        max-width: 500px; 
                        margin: 30px auto; 
                        background: rgba(255,255,255,0.1);
                        padding: 20px;
                        border-radius: 10px;
                        text-align: left;
                    }
                </style>
            </head>
            <body>
                <h1>📱 Escaneie o QR Code</h1>
                <img src="${qrCodeData}" alt="QR Code">
                <div class="instructions">
                    <div>1️⃣ Abra o WhatsApp no celular</div>
                    <div>2️⃣ Toque em ⋮ → Aparelhos conectados</div>
                    <div>3️⃣ Toque em "Conectar aparelho"</div>
                    <div>4️⃣ Escaneie este QR Code</div>
                </div>
                <p><small>Página atualiza automaticamente</small></p>
            </body>
            </html>
        `);
    } else {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Gerando QR Code...</title>
                <meta http-equiv="refresh" content="3">
                <style>
                    body { 
                        font-family: Arial; 
                        text-align: center; 
                        padding: 50px; 
                        background: #0f172a; 
                        color: white; 
                    }
                    .loading { font-size: 48px; }
                </style>
            </head>
            <body>
                <div class="loading">⏳</div>
                <h1>Gerando QR Code...</h1>
            </body>
            </html>
        `);
    }
});

// Status
app.get('/status', (req, res) => {
    res.json({ 
        status: isConnected ? 'connected' : 'disconnected',
        ready: isConnected,
        hasQR: qrCodeData !== null
    });
});

// Enviar mensagem
app.post('/send-message', async (req, res) => {
    try {
        if (!isConnected || !sock) {
            return res.status(400).json({ error: 'WhatsApp não conectado' });
        }

        const { number, message } = req.body;
        
        if (!number || !message) {
            return res.status(400).json({ error: 'Número e mensagem obrigatórios' });
        }

        const formattedNumber = number.replace(/\D/g, '');
        const jid = `${formattedNumber}@s.whatsapp.net`;

        await sock.sendMessage(jid, { text: message });
        
        res.json({ success: true, message: 'Mensagem enviada!' });
    } catch (error) {
        console.error('Erro:', error);
        res.status(500).json({ error: error.message });
    }
});

// Home
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>WhatsApp Bot</title>
            <style>
                body { 
                    font-family: Arial; 
                    max-width: 600px; 
                    margin: 50px auto; 
                    padding: 20px;
                    background: #0f172a;
                    color: white;
                }
                .status { 
                    padding: 20px; 
                    background: ${isConnected ? '#10b981' : '#ef4444'}; 
                    border-radius: 10px;
                    text-align: center;
                    margin: 20px 0;
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
            </style>
        </head>
        <body>
            <h1>🤖 WhatsApp Bot Server</h1>
            <div class="status">
                Status: ${isConnected ? '✅ Conectado' : '⏳ Desconectado'}
            </div>
            <a href="/qr">📱 ${isConnected ? 'Verificar Conexão' : 'Conectar WhatsApp'}</a>
            <a href="/status">📊 Status (JSON)</a>
        </body>
        </html>
    `);
});

const PORT = process.env.PORT || 21465;
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
