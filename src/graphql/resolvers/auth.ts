import User from "../../models/User.js";
import { generateToken } from "../../utils/jwt.js";
import { type Context, UserRole, type AuthResponse } from "../../types/index.js";
import { GraphQLError } from "graphql";

export interface SignupInput {
  email: string;
  password: string;
  role: UserRole;
}

export interface LoginInput {
  email: string;
  password: string;
}

export const authResolvers = {
  Query: {
    /**
     * Get current authenticated user
     */
    me: async (_: any, __: any, context: Context) => {
      if (!context.user) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      const user = await User.findById(context.user.userId);

      if (!user) {
        throw new GraphQLError("User not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      return {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      };
    },

    /**
     * Get user by ID (admin only)
     */
    getUser: async (_: any, { id }: { id: string }, context: Context) => {
      if (!context.user) {
        throw new GraphQLError("Not authenticated", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      // Only admins can get other users
      if (context.user.role !== UserRole.ADMIN && context.user.userId !== id) {
        throw new GraphQLError("Insufficient permissions", {
          extensions: { code: "FORBIDDEN" },
        });
      }

      const user = await User.findById(id);

      if (!user) {
        throw new GraphQLError("User not found", {
          extensions: { code: "NOT_FOUND" },
        });
      }

      return {
        id: user._id.toString(),
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
      };
    },
  },

  Mutation: {
    /**
     * User signup
     */
    signup: async (
      _: any,
      { input }: { input: SignupInput },
    ): Promise<AuthResponse> => {
      const { email, password, role } = input;

      // Validate input
      if (!email || !password || !role) {
        throw new GraphQLError("All fields are required", {
          extensions: { code: "BAD_REQUEST" },
        });
      }

      if (password.length < 6) {
        throw new GraphQLError("Password must be at least 6 characters long", {
          extensions: { code: "BAD_REQUEST" },
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email: email.toLowerCase() });

      if (existingUser) {
        throw new GraphQLError("User with this email already exists", {
          extensions: { code: "BAD_REQUEST" },
        });
      }

      // Create new user
      const user = await User.create({
        email: email.toLowerCase(),
        password,
        role,
      });

      // Generate JWT token
      const token = generateToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      return {
        token,
        user: {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
          createdAt: user.createdAt.toISOString(),
        },
      };
    },

    /**
     * User login
     */
    login: async (
      _: any,
      { input }: { input: LoginInput },
    ): Promise<AuthResponse> => {
      const { email, password } = input;

      // Validate input
      if (!email || !password) {
        throw new GraphQLError("Email and password are required", {
          extensions: { code: "BAD_REQUEST" },
        });
      }

      // Find user by email (include password field)
      const user = await User.findOne({ email: email.toLowerCase() }).select(
        "+password",
      );

      if (!user) {
        throw new GraphQLError("Invalid email or password", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      // Check password
      const isPasswordValid = await user.comparePassword(password);

      if (!isPasswordValid) {
        throw new GraphQLError("Invalid email or password", {
          extensions: { code: "UNAUTHENTICATED" },
        });
      }

      // Generate JWT token
      const token = generateToken({
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
      });

      return {
        token,
        user: {
          id: user._id.toString(),
          email: user.email,
          role: user.role,
          createdAt: user.createdAt.toISOString(),
        },
      };
    },
  },
};
