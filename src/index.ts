import express from "express";
import { ApolloServer } from "apollo-server-express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDatabase } from "./config/database.js";
import { typeDefs } from "./graphql/typeDefs/index.js";
import { resolvers } from "./graphql/resolvers/index.js";
import { createContext } from "./middleware/auth.js";
import { ApolloServerPluginLandingPageLocalDefault } from "apollo-server-core";


dotenv.config();

const PORT = process.env.PORT || 4000;
const FRONTEND_URLS = process.env.FRONTEND_URL 
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim()) 
  : ["http://localhost:3000", "https://intern-matching.vercel.app"];

console.log("CORS Allowed Origins:", FRONTEND_URLS);

async function startServer() {
  // Create Express a
  const app = express();

  // CORS configuration
  const corsOptions: cors.CorsOptions = {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);
      
      // Always allow localhost:3000 for development convenience
      const allowedOrigins = [...FRONTEND_URLS];
      if (allowedOrigins.indexOf("http://localhost:3000") === -1) {
        allowedOrigins.push("http://localhost:3000");
      }

      if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        console.warn(`CORS Blocked: Origin ${origin} is not in allowed list:`, allowedOrigins);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    optionsSuccessStatus: 200
  };

  app.use(cors(corsOptions));

  await connectDatabase();



  // Create Apollo Server
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: createContext,
    formatError: (error: any) => {
      // Log error for debugging
      console.error("GraphQL Error:", error);

      // Return formatted errr
      return {
        message: error.message,
        extensions: error.extensions,
      };
    },
    introspection: process.env.NODE_ENV !== "production",
    plugins: [ApolloServerPluginLandingPageLocalDefault({ embed: true })],
  });

  // Start Apollo Server
  await server.start();
  
  server.applyMiddleware({ app: app as any, path: "/graphql", cors: false });

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "OK",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      allowedOrigins: FRONTEND_URLS,
      nodeEnv: process.env.NODE_ENV
    });
  });

  // Start Express server
  app.listen(PORT, () => {
    console.log(
      `🚀 Server ready at http://localhost:${PORT}${server.graphqlPath}`,
    );
    console.log(
      `📊 GraphQL Playground available at http://localhost:${PORT}${server.graphqlPath}`,
    );
    console.log(`🏥 Health check at http://localhost:${PORT}/health`);
  });
}

// Start the server
startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
