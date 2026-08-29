import { Request, Response, NextFunction } from "express";
import { getRequestClient } from "../clients/supabaseClient";
import { Role, Staff } from "@prisma/client";
import { User } from "@supabase/supabase-js";
import prisma from "../database/prisma";

declare global {
  namespace Express {
    interface Request {
      dbUser?: Staff | null;
      supabaseUser?: User | null;
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const supabase = getRequestClient(req, res);

    const authHeader = req.headers.authorization;
    let access_token: string | undefined;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      access_token = authHeader.substring(7);
    }

    if (!access_token) {
      res.status(401).json({ error: "Missing or invalid token" });
      return;
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(access_token);

    if (error) {
      console.warn("Authentication error:", error.message);
      res.status(401).json({
        error: "Authentication required",
        message: "Please log in to access this resource",
      });
      return;
    }

    if (!user) {
      res.status(401).json({
        error: "Authentication required",
        message: "No user found in session",
      });
      return;
    }

    req.supabaseUser = user;

    let dbUser = await prisma.staff.findUnique({
      where: {
        id: user.id,
      },
    });

    if (!dbUser) {
      res.status(401).json({
        error: "Authentication required",
        message: "No user found in database",
      });
      return;
    }

    if (dbUser.role === Role.NoRole) {
      res.status(401).json({
        error: "Authentication required",
        message: "No role found in database",
      });
      return;
    }

    req.dbUser = dbUser;

    next();
  } catch (err) {
    console.error("Unexpected auth middleware error:", err);
    res.status(500).json({
      error: "Server error",
      message: "An error occurred while authenticating your request",
    });
  }
}

export async function requireLogIn(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const supabase = getRequestClient(req, res);

    const authHeader = req.headers.authorization;
    let access_token: string | undefined;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      access_token = authHeader.substring(7);
    }

    if (!access_token) {
      res.status(401).json({ error: "Missing or invalid token" });
      return;
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(access_token);

    if (error) {
      console.warn("Authentication error:", error.message);
      res.status(401).json({
        error: "Authentication required",
        message: "Please log in to access this resource",
      });
      return;
    }

    if (!user) {
      res.status(401).json({
        error: "Authentication required",
        message: "No user found in session",
      });
      return;
    }
    req.supabaseUser = user;
    next();
  } catch (err) {
    console.error("Unexpected auth middleware error:", err);
    res.status(500).json({
      error: "Server error",
      message: "An error occurred while authenticating your request",
    });
  }
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const supabase = getRequestClient(req, res);

    const authHeader = req.headers.authorization;
    let access_token: string | undefined;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      access_token = authHeader.substring(7);
    }

    if (!access_token) {
      res.status(401).json({ error: "Missing or invalid token" });
      return;
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(access_token);

    if (error) {
      console.warn("Authentication error:", error.message);
      res.status(401).json({
        error: "Authentication required",
        message: "Please log in to access this resource",
      });
      return;
    }

    if (!user) {
      res.status(401).json({
        error: "Authentication required",
        message: "No user found in session",
      });
      return;
    }

    req.supabaseUser = user;

    let dbUser = await prisma.staff.findUnique({
      where: {
        id: user.id,
      },
    });

    if (!dbUser) {
      res.status(401).json({
        error: "Authentication required",
        message: "No user found in database",
      });
      return;
    }

    if (dbUser.role !== Role.Admin) {
      res.status(401).json({
        error: "Authentication required",
        message: "Insufficient permissions to access this resource",
      });
      return;
    }

    req.dbUser = dbUser;

    next();
  } catch (err) {
    console.error("Unexpected auth middleware error:", err);
    res.status(500).json({
      error: "Server error",
      message: "An error occurred while authenticating your request",
    });
  }
}
