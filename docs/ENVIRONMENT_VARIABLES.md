# Environment Variables Configuration Guide

SMServer now supports configuration via environment variables, making it easier to deploy in containerized environments like Docker and Kubernetes.

## Overview

- **Configuration Priority**: Environment Variables > YAML File > Defaults
- **Use Case**: Perfect for Docker, Kubernetes, CI/CD pipelines, and 12-factor apps
- **Backward Compatible**: Existing `config.yaml` files continue to work

## Quick Start

### Docker Compose (Easiest)

1. Create `.env` file:
```bash
cp .env.example .env
```

2. Edit `.env`:
```bash
JWT_SECRET=your-super-secret-key
ADMIN_PASSWORD=your-secure-password
```

3. Start services:
```bash
docker-compose up -d
```

### Standalone Docker

```bash
docker run -d \
  -p 8080:8080 \
  -p 3000:3000 \
  -e SM_APP_JWT_SECRET=your-secret \
  -e SM_DATABASE_DSN=user:pass@tcp(host:3306)/db \
  smserver:latest
```

### Kubernetes

See `k8s-deployment.example.yaml` for a complete example using ConfigMap and Secret.

## All Environment Variables

### Application Settings

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SM_APP_ADDR` | No | `:8080` | Server listen address |
| `SM_APP_JWT_SECRET` | **Yes** | - | JWT signing secret key |
| `SM_APP_ALLOW_ORIGINS` | No | - | CORS allowed origins (comma-separated) |

### Database Settings

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SM_DATABASE_DRIVER` | No | `mysql` | Database driver (only mysql supported) |
| `SM_DATABASE_DSN` | **Yes** | - | MySQL connection string |
| `SM_DATABASE_MAX_OPEN` | No | `10` | Maximum open connections |
| `SM_DATABASE_MAX_IDLE` | No | `2` | Maximum idle connections |

### Security Settings

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SM_SECURITY_DEFAULT_ADMIN_USER` | No | `admin` | Default admin username |
| `SM_SECURITY_DEFAULT_ADMIN_PASSWORD` | No | - | Default admin password |

## Examples

### Development Environment

```bash
export SM_APP_JWT_SECRET="dev-secret-key"
export SM_DATABASE_DSN="root:password@tcp(localhost:3306)/smserver?charset=utf8mb4&parseTime=True&loc=Local"
export SM_APP_ALLOW_ORIGINS="http://localhost:3000"

cd backend
go run main.go
```

### Production Environment

```bash
export SM_APP_JWT_SECRET="$(openssl rand -base64 32)"
export SM_DATABASE_DSN="smserver:${DB_PASSWORD}@tcp(mysql-prod:3306)/smserver?charset=utf8mb4&parseTime=True&loc=Local"
export SM_APP_ALLOW_ORIGINS="https://smserver.yourdomain.com"
export SM_SECURITY_DEFAULT_ADMIN_PASSWORD="$(openssl rand -base64 16)"

./smserver
```

### Hybrid Configuration

You can mix YAML and environment variables:

**config.yaml:**
```yaml
app:
  addr: ":8080"
  allow_origins:
    - "http://localhost:3000"
database:
  driver: "mysql"
  max_open: 10
  max_idle: 2
```

**Environment (overrides YAML):**
```bash
export SM_APP_JWT_SECRET="production-secret"
export SM_DATABASE_DSN="user:pass@tcp(prod-db:3306)/smserver?..."
export SM_SECURITY_DEFAULT_ADMIN_PASSWORD="secure-pass"
```

This approach keeps static config in YAML and sensitive data in environment variables.

## Best Practices

1. **Never commit secrets**: Use `.env` files locally and secrets management in production
2. **Use strong secrets**: Generate JWT secret with `openssl rand -base64 32`
3. **Separate concerns**: Use ConfigMap for config, Secret for sensitive data in K8s
4. **Validate on startup**: The app will fail fast if required variables are missing
5. **Document defaults**: Always document what happens when an env var is not set

## Testing

Run the test suite to verify environment variable functionality:

```bash
cd backend/config
go test -v
```

## Troubleshooting

### "jwt_secret is required" error

Set `SM_APP_JWT_SECRET`:
```bash
export SM_APP_JWT_SECRET="your-secret-key"
```

Or add to `.env` for Docker Compose:
```
JWT_SECRET=your-secret-key
```

### CORS errors in browser

Set allowed origins:
```bash
export SM_APP_ALLOW_ORIGINS="http://localhost:3000,https://yourdomain.com"
```

### Database connection fails

Check your DSN format:
```bash
export SM_DATABASE_DSN="user:password@tcp(host:3306)/database?charset=utf8mb4&parseTime=True&loc=Local"
```

## Migration from config.yaml Only

If you're currently using only `config.yaml`:

1. Your existing setup continues to work (backward compatible)
2. To adopt env vars, gradually move secrets to environment:
   ```bash
   # Start with just secrets
   export SM_APP_JWT_SECRET="..."
   export SM_SECURITY_DEFAULT_ADMIN_PASSWORD="..."
   # Keep other config in YAML
   ```
3. Eventually move all config to env vars for 12-factor compliance

## References

- [12-Factor App Config](https://12factor.net/config)
- [Docker Environment Variables](https://docs.docker.com/compose/environment-variables/)
- [Kubernetes ConfigMaps](https://kubernetes.io/docs/concepts/configuration/configmap/)
- [Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)
