#!/bin/bash
# ============================================================
# 日语学习独立站 — Ubuntu 部署脚本
# 目标：ConoHa VPS (Ubuntu 22.04+)
# 用法：chmod +x deploy.sh && sudo ./deploy.sh
# ============================================================

set -euo pipefail

# ---- 颜色 ----
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
err()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ---- 检查 root ----
if [ "$EUID" -ne 0 ]; then
  err "请以 root 身份运行: sudo ./deploy.sh"
fi

# ---- 配置（可自定义）----
DOMAIN="${DOMAIN:-xxxlangstudy.com}"
APP_DIR="${APP_DIR:-/var/www/study_system}"
NODE_VERSION="${NODE_VERSION:-20}"
DB_NAME="${DB_NAME:-study_system}"
DB_USER="${DB_USER:-study_user}"
DB_PASS="${DB_PASS:-$(openssl rand -base64 24)}"
JWT_SECRET="${JWT_SECRET:-$(openssl rand -base64 48)}"
TIMEZONE="${TIMEZONE:-Asia/Tokyo}"

# ============================================================
# 1. 系统更新 & 基础工具
# ============================================================
log "更新系统包..."
apt update && apt upgrade -y
apt install -y curl wget git build-essential nginx certbot python3-certbot-nginx ufw

# 设置时区
timedatectl set-timezone "$TIMEZONE"

# ============================================================
# 2. 安装 Node.js 20 + PM2
# ============================================================
log "安装 Node.js $NODE_VERSION..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt install -y nodejs

log "安装 PM2..."
npm install -g pm2

# ============================================================
# 3. 安装 PostgreSQL 16
# ============================================================
log "安装 PostgreSQL..."
apt install -y postgresql postgresql-contrib

systemctl start postgresql
systemctl enable postgresql

# 创建数据库和用户
su - postgres -c "psql -c \"CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';\""
su - postgres -c "psql -c \"CREATE DATABASE $DB_NAME OWNER $DB_USER;\""
su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;\""

log "数据库 $DB_NAME 创建成功"

# ============================================================
# 4. 克隆/更新项目代码
# ============================================================
if [ -d "$APP_DIR" ]; then
  warn "目录 $APP_DIR 已存在，执行 git pull..."
  cd "$APP_DIR"
  git pull origin main
else
  log "克隆项目到 $APP_DIR..."
  git clone https://github.com/shangwenbaicha/study_system.git "$APP_DIR"
  cd "$APP_DIR"
fi

# ============================================================
# 5. 配置环境变量
# ============================================================
log "配置 .env 文件..."
cat > "$APP_DIR/.env" << EOF
# ============================================================
# 生产环境配置
# ============================================================

# 数据库
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}?schema=public"

# JWT
JWT_SECRET="${JWT_SECRET}"

# 服务器
PORT=3001
NODE_ENV=production
CORS_ORIGIN="https://${DOMAIN},https://ja.${DOMAIN},https://en.${DOMAIN}"

# 翻译服务（默认 LibreTranslate，可选 deepseek）
TRANSLATION_PROVIDER=libretranslate
# DEEPSEEK_API_KEY=your_key_here

# 文件上传
UPLOAD_DIR=${APP_DIR}/uploads
MAX_FILE_SIZE=10485760

# SMTP 邮件（可选，用于密码重置等）
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=your_email
# SMTP_PASS=your_password
# MAIL_FROM=noreply@${DOMAIN}
EOF

log ".env 文件已生成"

# ============================================================
# 6. 安装项目依赖 & 构建
# ============================================================
log "安装 npm 依赖..."
cd "$APP_DIR"
npm install

log "生成 Prisma Client..."
npx prisma generate

log "执行数据库迁移..."
npx prisma migrate deploy

log "构建前端..."
cd "$APP_DIR/apps/web"
npm install
npm run build

# ============================================================
# 7. 配置 Nginx（三语网址）
# ============================================================
log "配置 Nginx..."

# 创建上传目录
mkdir -p "$APP_DIR/uploads"/{videos,audio,pdfs,images,avatars}
chown -R www-data:www-data "$APP_DIR/uploads"

# 主域名（中文）
cat > /etc/nginx/sites-available/${DOMAIN}.conf << NGINX_ZH
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${DOMAIN} www.${DOMAIN};

    # SSL（首次部署用 certbot 自动获取）
    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;

    root ${APP_DIR}/apps/web/dist;
    index index.html;

    # 中文路由
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # API 反向代理
    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # 文件上传访问
    location /uploads/ {
        alias ${APP_DIR}/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
NGINX_ZH

# 日语子域名
cat > /etc/nginx/sites-available/ja.${DOMAIN}.conf << NGINX_JA
server {
    listen 80;
    server_name ja.${DOMAIN};
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ja.${DOMAIN};

    ssl_certificate /etc/letsencrypt/live/ja.${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ja.${DOMAIN}/privkey.pem;

    root ${APP_DIR}/apps/web/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    location /uploads/ {
        alias ${APP_DIR}/uploads/;
        expires 30d;
    }
}
NGINX_JA

# 英语子域名
cat > /etc/nginx/sites-available/en.${DOMAIN}.conf << NGINX_EN
server {
    listen 80;
    server_name en.${DOMAIN};
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name en.${DOMAIN};

    ssl_certificate /etc/letsencrypt/live/en.${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/en.${DOMAIN}/privkey.pem;

    root ${APP_DIR}/apps/web/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    location /uploads/ {
        alias ${APP_DIR}/uploads/;
        expires 30d;
    }
}
NGINX_EN

# 启用站点
ln -sf /etc/nginx/sites-available/${DOMAIN}.conf /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/ja.${DOMAIN}.conf /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/en.${DOMAIN}.conf /etc/nginx/sites-enabled/

# 删除默认站点
rm -f /etc/nginx/sites-enabled/default

# ============================================================
# 8. 配置防火墙
# ============================================================
log "配置 UFW 防火墙..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# ============================================================
# 9. 配置 SSL 证书（首次部署需要交互）
# ============================================================
log "获取 SSL 证书..."
warn "首次部署需要验证域名 DNS 已指向本服务器"
warn "如果尚未配置，请先添加 DNS A 记录:"
warn "  ${DOMAIN} -> 服务器IP"
warn "  ja.${DOMAIN} -> 服务器IP"
warn "  en.${DOMAIN} -> 服务器IP"
read -p "DNS 已配置？(y/N): " DNS_OK
if [ "$DNS_OK" = "y" ] || [ "$DNS_OK" = "Y" ]; then
  certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --non-interactive --agree-tos -m admin@${DOMAIN}
  certbot --nginx -d ja.${DOMAIN} --non-interactive --agree-tos -m admin@${DOMAIN}
  certbot --nginx -d en.${DOMAIN} --non-interactive --agree-tos -m admin@${DOMAIN}

  # 自动续期
  systemctl enable certbot.timer
  systemctl start certbot.timer
else
  warn "请稍后手动运行: certbot --nginx -d ${DOMAIN}"
fi

# ============================================================
# 10. 启动服务（PM2）
# ============================================================
log "启动 API 服务..."
cd "$APP_DIR"

pm2 delete study-api 2>/dev/null || true
pm2 start services/api/dist/server.js --name study-api --cwd "$APP_DIR"
pm2 save
pm2 startup systemd -u root --hp /root

# 重启 Nginx
nginx -t && systemctl restart nginx

# ============================================================
# 11. 输出部署信息
# ============================================================
echo ""
echo "============================================"
echo -e "${GREEN}  部署完成！${NC}"
echo "============================================"
echo ""
echo "网站地址:"
echo "  中文: https://${DOMAIN}"
echo "  日语: https://ja.${DOMAIN}"
echo "  英语: https://en.${DOMAIN}"
echo ""
echo "API 地址: https://${DOMAIN}/api"
echo "健康检查: https://${DOMAIN}/api/health"
echo ""
echo "数据库:"
echo "  名称: ${DB_NAME}"
echo "  用户: ${DB_USER}"
echo "  密码: ${DB_PASS}"
echo ""
echo "管理命令:"
echo "  pm2 status              # 查看进程状态"
echo "  pm2 logs study-api      # 查看日志"
echo "  pm2 restart study-api   # 重启服务"
echo "  nginx -t && systemctl reload nginx  # 重载 Nginx"
echo ""
echo "请保存以上数据库密码！"
echo "============================================"
