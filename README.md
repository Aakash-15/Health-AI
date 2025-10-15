Yes, here is the text formatted for easy copying and pasting.

## HealthAI Symptom Checker 🩺

HealthAI is an intelligent, conversational web application designed to help users understand their health symptoms. Powered by the Google Gemini API, it guides users through a series of questions to gather information and then provides a structured analysis of potential causes, home care advice, and guidance on when to seek professional medical attention.

-----

### ✨ Key Features

  * **🤖 Conversational AI**: Engages users in a dynamic Q\&A flow to gather detailed symptom information.
  * **🧠 Intelligent Analysis**: Leverages the Google Gemini API to generate empathetic and structured health insights.
  * **👤 User Authentication**: Secure login and registration powered by Firebase Authentication.
  * **🤝 Personalized Insights**: Tailors analysis based on user profile data (age, gender) for more relevant results.
  * **📜 Analysis History**: Users can view, review, and delete their past symptom analysis reports.
  * **🗣️ Text-to-Speech**: An accessibility feature to read the analysis results aloud.
  * **📋 Profile Management**: Allows users to save and update their personal details.

-----

### 🛠️ Tech Stack

This project is built with a modern, full-stack JavaScript architecture.

  * **Frontend**:
      * HTML5
      * CSS3
      * JavaScript
  * **Backend**:
      * Node.js
  * **Database & Auth**:
      * **Firebase Authentication**: For user management.
      * **Google Firestore**: A NoSQL database for storing user profiles and analysis history.
  * **AI Engine**:
      * **Google Gemini API**: For generating questions and final analysis.

-----

### ⚙️ Setup and Installation

To get a local copy up and running, follow these simple steps.

#### Prerequisites

  * **Node.js** and **npm** installed on your machine.
  * A **Google Account** to set up Firebase and the Gemini API.

#### 1\. Backend Setup

  * **Clone the Repository**
    ```bash
    git clone https://github.com/Aakash-15/Health-AI.git
    cd Health-AI
    ```
  * **Install Backend Dependencies**
    Since your `package.json` is in the root directory, run the install command from there.
    ```bash
    npm install
    ```
  * **Set up Firebase**
      * Go to the Firebase Console and create a new project.
      * Enable Authentication (with Email/Password provider) and set up the Firestore Database.
      * Go to `Project settings` \> `Service accounts` and generate a new private key.
      * **Important**: Place the downloaded `serviceAccountKey.json` file inside the `/Backend` directory.
  * **Get Google Gemini API Key**
      * Go to Google AI Studio and create a new API key.
  * **Configure Environment Variables**
      * Create a file named `.env` inside the `/Backend` directory.
      * Add your Gemini API key to it:
        ```
        # Backend/.env
        GEMINI_API_KEY=your_gemini_api_key_here
        ```
  * **Start the Backend Server**
    Run the server file, which is located in the `Backend` directory.
    ```bash
    node Backend/server.js
    ```
    Your backend will now be running on `http://localhost:5000`.

#### 2\. Frontend Setup

  * **Configure Firebase Credentials**
      * In the Firebase Console, go to your project's settings and create a new Web app.
      * Copy the `firebaseConfig` object provided.
      * Open `Frontend/index.html` and paste your configuration into the `<script>` block, replacing the placeholders.
  * **Run the Frontend**
      * Simply open the `Frontend/index.html` file in your web browser. Using a tool like the VS Code "Live Server" extension is recommended.
