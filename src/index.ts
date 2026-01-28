import express from "express";
import { ApolloServer } from "apollo-server-express";
import cors from "cors";
import dotenv from "dotenv";
import { connectDatabase } from "./config/database.js";
import { typeDefs } from "./graphql/typeDefs/index.js";
import { resolvers } from "./graphql/resolvers/index.js";
import { createContext } from "./middleware/auth.js";

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 4000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

async function startServer() {
  // Create Express app
  const app = express();

  // CORS configuration
  app.use(
    cors({
      origin: FRONTEND_URL,
      credentials: true,
    }),
  );

  // Body parser
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Connect to MongoDB
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
  });

  // Start Apollo Server
  await server.start();
  
  server.applyMiddleware({ app, path: "/graphql", cors: false });

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.status(200).json({
      status: "OK",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
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
