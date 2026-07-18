import dotenv from "dotenv";
// override:true so the project's .env wins over any machine-level variable of
// the same name — see the note in .env about DATABASE_URL on this box.
dotenv.config({ override: true });

const { app } = await import("./app.js");

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
