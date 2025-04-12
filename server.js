const express = require('express');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors()); // Allows cross-origin requests from frontend (admin panel)
app.use(express.json()); // Parse JSON request bodies

// Example Route for testing
app.get('/', (req, res) => {
  res.send('Hello from Node.js Backend!');
});

// Route for getting candidates (replace with database integration later)
app.get('/candidates', (req, res) => {
    const mockCandidates = [
        { id: 1, name: "John Doe", status: "Passed" },
        { id: 2, name: "Jane Smith", status: "Rejected" },
      ];
    res.json(mockCandidates);
});

// Backend (Node.js with Express)
app.get('/candidates/:id', (req, res) => {
    const mockCandidates = [
        {
          id: 1,
          name: "Иван Иванов",
          username: "ivanov",
          testStatus: "закончил тест",  // Статус тестирования
          adminStatus: "прошёл тест",  // Статус, назначаемый админом
          testDate: "2025-04-10",
          resumeUrl: "/path/to/resume1.pdf", // URL to resume
          testAnswers: [
            { question: "Ты командный игрок?", answer: "Да" },
            { question: "Любишь решать проблемы?", answer: "Скорее да" },
            { question: "Что важнее — результат или процесс?", answer: "Результат" },
          ]
        },
        {
          id: 2,
          name: "Анна Петрова",
          username: "anna123",
          testStatus: "не начал тест",  // Статус тестирования
          adminStatus: "отказ",  // Статус, назначаемый админом
          testDate: "2025-04-05",
          resumeUrl: "/path/to/resume2.doc", // URL to resume
          testAnswers: []
        }
      ];

    const candidateId = parseInt(req.params.id);
    const candidate = mockCandidates.find(c => c.id === candidateId);
  
    if (candidate) {
      res.json(candidate);  // Return the candidate as JSON
    } else {
      res.status(404).json({ message: 'Candidate not found' });
    }
  });

//   for mini test start
const questions = [
    { id: 1, question: "What is your greatest strength?" },
    { id: 2, question: "Describe a time you solved a difficult problem." },
    { id: 3, question: "Why do you want to work with us?" }
  ];
  
  // Endpoint to get questions
  app.get('/api/questions', (req, res) => {
    res.json(questions);
  });
  
  // Endpoint to add a new question (optional)
  app.post('/api/questions', express.json(), (req, res) => {
    const { question } = req.body;
    const newQuestion = { id: questions.length + 1, question };
    questions.push(newQuestion);
    res.status(201).json(newQuestion);
  });
  
  // Endpoint to update a question (optional)
  app.put('/api/questions/:id', express.json(), (req, res) => {
    const { id } = req.params;
    const { question } = req.body;
    const index = questions.findIndex(q => q.id === parseInt(id));
  
    if (index === -1) {
      return res.status(404).json({ error: "Question not found" });
    }
  
    questions[index] = { id: parseInt(id), question };
    res.json(questions[index]);
  });
  
  // Endpoint to delete a question (optional)
  app.delete('/api/questions/:id', (req, res) => {
    const { id } = req.params;
    const index = questions.findIndex(q => q.id === parseInt(id));
  
    if (index === -1) {
      return res.status(404).json({ error: "Question not found" });
    }
  
    const deletedQuestion = questions.splice(index, 1);
    res.json(deletedQuestion);
  });
  
// for mini test end

// FAQ start
let faqs = [
    {
      id: 1,
      question: "What is your return policy?",
      answer: "You can return any item within 30 days for a full refund."
    },
    {
      id: 2,
      question: "Do you offer customer support?",
      answer: "Yes, we provide 24/7 customer support via chat and email."
    },
    {
      id: 3,
      question: "Where can I find my order history?",
      answer: "You can view your order history in the 'Orders' section of your account."
    }
  ];
  
  // Get all FAQs
  app.get('/api/faqs', (req, res) => {
    res.json(faqs);
  });
  
  // Add a new FAQ
  app.post('/api/faqs', (req, res) => {
    const { question, answer } = req.body;
    const newFaq = {
      id: uuidv4(),
      question,
      answer
    };
    faqs.push(newFaq);
    res.status(201).json(newFaq);
  });
  
  // Update an existing FAQ
  app.put('/api/faqs/:id', (req, res) => {
    const { id } = req.params;
    const { question, answer } = req.body;
  
    const index = faqs.findIndex(faq => faq.id === id);
    if (index !== -1) {
      faqs[index] = { id, question, answer };
      res.json(faqs[index]);
    } else {
      res.status(404).json({ message: 'FAQ not found' });
    }
  });
  
  // Delete an FAQ
  app.delete('/api/faqs/:id', (req, res) => {
    const { id } = req.params;
    const initialLength = faqs.length;
    faqs = faqs.filter(faq => faq.id !== id);
  
    if (faqs.length < initialLength) {
      res.status(204).end();
    } else {
      res.status(404).json({ message: 'FAQ not found' });
    }
  });
  
// FAQ end

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
