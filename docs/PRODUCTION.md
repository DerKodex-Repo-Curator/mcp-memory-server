# Production Deployment Guide

This guide covers deploying the MCP Memory Server in production environments.

## Prerequisites

- Node.js 18+ installed
- Ollama running and accessible
- SSL certificates (for HTTPS)
- Process manager (PM2 recommended)
- Reverse proxy (Nginx recommended)

## Configuration

### 1. Environment Setup

Create a production `.env` file:

```bash
# Server
NODE_ENV=production
PORT=8090

# Ollama
OLLAMA_URL=http://localhost:11434

# Brain/MCP
MCP_URL=http://localhost:3000
BRAIN_ENABLED=true
BRAIN_DATA_DIR=/var/lib/memory-server/brain

# Security
MAX_PROMPT_LENGTH=10000
MAX_RESPONSE_TOKENS=4096
RATE_LIMIT_PER_MINUTE=30
RATE_LIMIT_PER_HOUR=500

# Performance
MAX_CONTEXT_TOKENS=2000
SIMILARITY_LIMIT=10
RELEVANCE_THRESHOLD=0.3
CACHE_TTL=3600
CACHE_MAX_SIZE=5000

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/memory-server/app.log
```

### 2. Directory Structure

```bash
sudo mkdir -p /var/lib/memory-server/{brain,plugins,data}
sudo mkdir -p /var/log/memory-server
sudo chown -R $USER:$USER /var/lib/memory-server
sudo chown -R $USER:$USER /var/log/memory-server
```

## Installation

### 1. Clone and Build

```bash
cd /opt
sudo git clone [repository-url] memory-server
cd memory-server
npm install --production
npm run build
```

### 2. Install PM2

```bash
npm install -g pm2
```

### 3. Create PM2 Ecosystem File

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'memory-server',
    script: './dist/index.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 8090
    },
    error_file: '/var/log/memory-server/pm2-error.log',
    out_file: '/var/log/memory-server/pm2-out.log',
    log_file: '/var/log/memory-server/pm2-combined.log',
    time: true,
    max_memory_restart: '1G',
    watch: false,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s'
  }]
};
```

### 4. Start with PM2

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Follow the instructions to enable startup
```

## Nginx Configuration

Create `/etc/nginx/sites-available/memory-server`:

```nginx
upstream memory_server {
    server 127.0.0.1:8090;
    server 127.0.0.1:8091;  # If using multiple instances
    keepalive 64;
}

server {
    listen 80;
    server_name memory.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name memory.yourdomain.com;

    ssl_certificate /etc/ssl/certs/memory-server.crt;
    ssl_certificate_key /etc/ssl/private/memory-server.key;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Proxy settings
    location / {
        proxy_pass http://memory_server;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts for long-running requests
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        
        # Buffer settings
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://memory_server/health;
        access_log off;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/memory-server /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Security Hardening

### 1. Firewall Rules

```bash
# Allow only necessary ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### 2. API Key Authentication

Add API key authentication by creating a plugin:

```javascript
// plugins/auth.js
export default {
  name: 'auth-plugin',
  version: '1.0.0',
  description: 'API key authentication',
  
  async beforeEnrichment(request, req) {
    const apiKey = req.headers['x-api-key'];
    const validKeys = process.env.API_KEYS?.split(',') || [];
    
    if (!validKeys.includes(apiKey)) {
      throw new Error('Invalid API key');
    }
    
    return request;
  }
};
```

### 3. Rate Limiting with Redis

Install Redis for distributed rate limiting:

```bash
sudo apt install redis-server
npm install redis rate-limiter-flexible
```

## Monitoring

### 1. Health Checks

Set up monitoring with your preferred service:

```bash
# Example with UptimeRobot
curl -X POST https://api.uptimerobot.com/v2/newMonitor \
  -d "api_key=YOUR_API_KEY" \
  -d "friendly_name=Memory Server" \
  -d "url=https://memory.yourdomain.com/health" \
  -d "type=1"
```

### 2. Logging

Configure centralized logging:

```javascript
// In production config
winston.add(new winston.transports.Syslog({
  host: 'logs.yourdomain.com',
  port: 514,
  protocol: 'udp4'
}));
```

### 3. Metrics

Add Prometheus metrics:

```bash
npm install prom-client
```

Create metrics endpoint in a plugin.

## Backup and Recovery

### 1. Automated Backups

Create `/opt/memory-server/backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/backup/memory-server"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup data
tar -czf $BACKUP_DIR/data_$DATE.tar.gz /var/lib/memory-server/

# Backup logs
tar -czf $BACKUP_DIR/logs_$DATE.tar.gz /var/log/memory-server/

# Keep only last 7 days
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

Add to crontab:

```bash
0 2 * * * /opt/memory-server/backup.sh
```

### 2. Recovery Procedure

```bash
# Stop services
pm2 stop memory-server

# Restore data
tar -xzf /backup/memory-server/data_YYYYMMDD_HHMMSS.tar.gz -C /

# Start services
pm2 start memory-server
```

## Performance Tuning

### 1. Node.js Optimization

```bash
# Set in ecosystem.config.js
node_args: "--max-old-space-size=4096"
```

### 2. Ollama Configuration

Ensure Ollama has sufficient resources:

```bash
# /etc/systemd/system/ollama.service
[Service]
Environment="OLLAMA_NUM_PARALLEL=4"
Environment="OLLAMA_MAX_LOADED_MODELS=2"
```

### 3. Database Optimization

If using a database for persistence:

```sql
-- Create indexes
CREATE INDEX idx_memories_created ON memories(created_at);
CREATE INDEX idx_memories_type ON memories(type);
CREATE INDEX idx_tasks_model ON tasks(model);
```

## Scaling

### Horizontal Scaling

1. **Multiple Instances**: PM2 cluster mode handles this
2. **Load Balancer**: Use HAProxy or AWS ALB
3. **Shared State**: Redis for cache and sessions
4. **Distributed Storage**: S3 or similar for embeddings

### Vertical Scaling

1. Increase server resources
2. Optimize memory usage
3. Use faster storage (NVMe SSD)

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   - Check for memory leaks: `pm2 monit`
   - Adjust cache sizes
   - Enable memory limits in PM2

2. **Slow Responses**
   - Check Ollama performance
   - Review enrichment settings
   - Enable performance monitoring

3. **Connection Errors**
   - Verify Ollama is running
   - Check firewall rules
   - Review proxy configuration

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug pm2 restart memory-server
```

## Maintenance

### Weekly Tasks
- Review logs for errors
- Check disk usage
- Update dependencies (security patches)

### Monthly Tasks
- Performance analysis
- Security audit
- Backup verification

### Quarterly Tasks
- Full system update
- Capacity planning
- Feature review

## Support

For production support:
1. Check logs: `/var/log/memory-server/`
2. Monitor metrics: PM2 dashboard
3. Review documentation
4. Contact maintainers

Remember: Always test changes in staging before deploying to production!
