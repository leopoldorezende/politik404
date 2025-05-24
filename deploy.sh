#!/bin/bash

echo "🔄 Atualizando repositório..."
git pull origin main

echo "📦 Instalando dependências do Node..."
cd server
npm install --omit=dev
cd ..

echo "🚚 Copiando dist para o Nginx..."
rm -rf /var/www/politik404/*
cp -r client/dist/* /var/www/politik404/

echo "🔁 Reiniciando servidor com PM2..."
pm2 restart politik404-server --update-env

echo "✅ Deploy com HTTPS finalizado!"