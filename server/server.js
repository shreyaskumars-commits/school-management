import app from "./src/app.js";
import { PORT } from "./src/config/index.js";
import { connectDB } from "./src/config/db.js";
import { seedUsers } from "./src/services/authService.js";
import { seedReviews, seedSchoolReviews } from "./src/services/reviewSeed.js";

await connectDB();
await seedUsers();
await seedReviews();
await seedSchoolReviews();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
