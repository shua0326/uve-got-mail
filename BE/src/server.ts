import express, { Request, Response } from "express";
import dotenv from "dotenv";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import authRoutes from "./routes/authRoutes";
import giphyRoutes from "./routes/giphyRoutes";
import mailRoutes from "./routes/mailRoutes";
import mailUserRoutes from "./routes/mailUserRoutes";
import friendRequestRoutes from "./routes/friendRequestRoutes";
import { requireAuth } from "./middlewares/authMiddleware";
import { openapiSpec } from "./docs/openapiSpec";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());
// FE (Vite dev server) and BE run on different origins/ports; helmet's default
// same-origin CORP header would block the FE from reading fetch() responses
// (recordings, Giphy search) even though CORS allows the request itself.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

app.get("/api-docs.json", (req: Request, res: Response) => {
  res.json(openapiSpec);
});
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));

app.use("/auth", authRoutes);
app.use("/giphy", giphyRoutes);
app.use("/mail", mailRoutes);
app.use("/user", mailUserRoutes);
// friendRequestController reads req.dbUser, which only requireAuth populates.
app.use("/friends", requireAuth, friendRequestRoutes);


app.get("/login-test", (req: Request, res: Response) => {
  // helmet's default CSP blocks the esm.sh module import and inline <script> below
  res.removeHeader("Content-Security-Policy");

  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    res
      .status(500)
      .send("Set SUPABASE_URL and SUPABASE_ANON_KEY in .env, then reload this page.");
    return;
  }

  res.send(`<!DOCTYPE html>
<html>
<head><title>Login Test</title></head>
<body>
  <h1>Login Test</h1>
  <button id="login">Sign in with Google</button>
  <button id="logout">Sign out</button>
  <pre id="status">Not signed in</pre>

  <script type="module">
    import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

    const supabase = createClient('${SUPABASE_URL}', '${SUPABASE_ANON_KEY}');
    const statusEl = document.getElementById('status');

    document.getElementById('login').onclick = () => {
      supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.href },
      });
    };

    document.getElementById('logout').onclick = async () => {
      await supabase.auth.signOut();
      statusEl.textContent = 'Signed out';
    };

    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        statusEl.textContent = 'Not signed in';
        return;
      }

      statusEl.textContent = 'Signed in as ' + session.user.email + '\\nVerifying with backend...';

      const res = await fetch('/auth/callback', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + session.access_token },
      });
      const body = await res.json();

      if (res.status === 401) {
        // Stale/invalid session cached locally - clear it so the next login starts fresh
        await supabase.auth.signOut();
        statusEl.textContent = 'Cached session was invalid, signed out. Click "Sign in with Google" again.\\n' + JSON.stringify(body, null, 2);
        return;
      }

      statusEl.textContent = 'Backend response:\\n' + JSON.stringify(body, null, 2);
    }

    checkSession();
  </script>
</body>
</html>`);
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
