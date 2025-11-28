# Deployment Guide for MediaTracker AI

This guide covers the steps to deploy the MediaTracker AI application to a production environment.

## Prerequisites

*   **Node.js**: v18 or higher
*   **Moonshot API Key**: A valid API key from Moonshot AI Platform.

## 1. Build the Application

The application is built using Vite. Run the following command to generate static assets:

```bash
npm install
npm run build
```

This will create a `dist` directory containing the optimized production build.

## 2. Environment Variables

Create a `.env.production` file (or set environment variables in your hosting provider) with the following key:

```
MOONSHOT_API_KEY=your_actual_api_key_here
```

**Note:** Since this is a client-side application, the API key will be embedded in the build or exposed to the browser. For a true commercial application, you should proxy these requests through a backend server to hide your API key.

## 3. Deploy to Netlify (Recommended)

1.  Drag and drop the `dist` folder to Netlify Drop, OR connect your GitHub repository.
2.  Set the Build Command to: `npm run build`
3.  Set the Publish Directory to: `dist`
4.  Add the `MOONSHOT_API_KEY` in Netlify's "Site settings > Build & deploy > Environment".

## 4. Deploy to Vercel

1.  Install Vercel CLI: `npm i -g vercel`
2.  Run `vercel` in the project root.
3.  Follow the prompts. Vercel automatically detects Vite settings.
4.  Add the Environment Variable in the Vercel Dashboard.

## 5. Docker Deployment (Optional)

You can serve the static files using Nginx:

```dockerfile
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## 6. Security & Performance Checklist

*   [ ] **API Key Protection**: Ensure you have set up usage quotas to prevent abuse.
*   [ ] **HTTPS**: Ensure your domain is served over HTTPS (default on Netlify/Vercel).
*   [ ] **Caching**: The build uses content hashing for effective browser caching.
