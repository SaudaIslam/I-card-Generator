const express = require("express");
const path = require("path");
const mysql = require("mysql");
const bodyParser = require("body-parser");
const multer = require("multer");
const bcrypt = require("bcrypt");
const bwipjs = require("bwip-js");
const app = express();
const port = 3000;

// Middleware
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Database connection
const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "",
  database: "id_card_generator",
});

db.connect((err) => {
  if (err) {
    console.error("Error connecting to the database:", err);
    return;
  }
  console.log("Connected to the MySQL database.");
});

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Serve the form HTML
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "Newdatabyform.html"));
});

// Handle form submission
app.post("/submit-form", upload.single("user-image"), (req, res) => {
  const {
    organizationName,
    addedDesignation,
    user_ID,
    name,
    fatherName,
    Batch,
    Contact_No,
    residency,
    expireDate,
  } = req.body;

  const userImage = req.file ? req.file.buffer : null;

  // Generate barcode
  bwipjs.toBuffer(
    {
      bcid: "code128",
      text: user_ID,
      scale: 2,
      height: 5,
      includetext: true,
      textxalign: "center",
    },
    (err, png) => {
      if (err) {
        console.error("Error generating barcode:", err);
        res.status(500).send("Server Error");
        return;
      }

      const sql =
        "INSERT INTO id_cards (organization_name, designation, user_id, name, father_name, batch, contact_number, residency, expireDate, user_image, barcode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
      const values = [
        organizationName,
        addedDesignation,
        user_ID,
        name,
        fatherName,
        Batch,
        Contact_No,
        residency,
        expireDate,
        userImage,
        png,
      ];

      db.query(sql, values, (err, result) => {
        if (err) {
          console.error("Error inserting data into the database:", err);
          res.status(500).send("Server Error");
          return;
        }
        res.send("Form data saved successfully!");
      });
    }
  );
});

// Serve the signup form HTML
app.get("/signup", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "signup.html"));
});

// Handle signup form submission
app.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const sql =
      "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";
    const values = [username, email, hashedPassword];

    db.query(sql, values, (err, result) => {
      if (err) {
        console.error("Error inserting data into the database:", err);
        res.status(500).send("Server Error");
        return;
      }
      res.redirect("/login.html");
    });
  } catch (err) {
    console.error("Error hashing password:", err);
    res.status(500).send("Server Error");
  }
});

// Serve the login form HTML
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// Handle login form submission
app.post('/login', (req, res) => {
  const { email, username, password } = req.body; // Ensure 'password' is used

  // Determine which identifier to use
  const sql = 'SELECT * FROM users WHERE email = ? OR username = ?';
  db.query(sql, [email || username, email || username], async (err, results) => {
    if (err) {
      console.error('Error querying the database:', err);
      res.status(500).send('Server Error');
      return;
    }

    if (results.length === 0) {
      res.status(401).send('Invalid email/username or password');
      return;
    }

    const user = results[0];

    try {
      const match = await bcrypt.compare(password, user.password); // Ensure 'password' is compared

      if (match) {
        res.redirect('/home.html');
      } else {
        res.status(401).send('Invalid email/username or password');
      }
    } catch (bcryptErr) {
      console.error('Error comparing passwords:', bcryptErr);
      res.status(500).send('Server Error');
    }
  });
});


// Serve the existing data HTML
app.get("/existingdata", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "existingdata.html"));
});

// Fetch all ID card data
app.get("/api/id-cards", (req, res) => {
  const sql = "SELECT * FROM id_cards";

  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching data from the database:", err);
      res.status(500).send("Server Error");
      return;
    }
    res.json(results);
  });
});

// Fetch a single ID card by ID
app.get("/api/id-cards/:id", (req, res) => {
  const { id } = req.params;
  const sql = "SELECT * FROM id_cards WHERE id = ?";

  db.query(sql, [id], (err, results) => {
    if (err) {
      console.error("Error fetching data from the database:", err);
      res.status(500).send("Server Error");
      return;
    }

    if (results.length === 0) {
      res.status(404).send("Card not found");
      return;
    }

    const card = results[0];
    // Convert binary data to base64
    if (card.user_image) {
      card.user_image = card.user_image.toString("base64");
    }
    if (card.barcode) {
      card.barcode = card.barcode.toString("base64");
    }

    res.json(card);
  });
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

