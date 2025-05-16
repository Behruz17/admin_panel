const express = require('express');
const cors = require('cors');
const app = express();
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const db = mysql.createPool({
  host: 'k98108ya.beget.tech',
  user: 'k98108ya_sardor',
  password: 'ZFsv8zX&o03X',
  database: 'k98108ya_sardor'
});

// Middleware
app.use(cors()); // Allows cross-origin requests from frontend (admin panel)
app.use(express.json()); // Parse JSON request bodies

app.get('/', (req, res) => {
  res.send('Hello from Node.js Backend!');
});

app.get('/candidates', (req, res) => {
  const sql = 'SELECT * FROM candidates'; // Change table name if needed

  db.query(sql, (err, results) => {
    if (err) {
      console.error('DB error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

app.get('/candidates/:id', (req, res) => {
  const candidateId = req.params.id;

  const query = `
  SELECT 
  u.id, 
  CONCAT(COALESCE(u.first_name, ''), ' ', COALESCE(u.last_name, '')) AS name, 
  u.username, 
  u.status AS adminStatus, 
  ts.status AS testStatus, 
  DATE(ts.created_at) AS testDate,
  (
    SELECT JSON_ARRAYAGG(ur.file_name)
    FROM user_resumes ur
    WHERE ur.user_id = u.telegram_id
  ) AS filePaths,
  (
    SELECT JSON_ARRAYAGG(
      JSON_OBJECT(
        'question', q.question_text,
        'answer', a.answer_text
      )
    )
    FROM answers a
    LEFT JOIN questions q ON q.id = a.question_id
    WHERE a.user_id = u.telegram_id
  ) AS testAnswers

FROM candidates u
LEFT JOIN test_sessions ts ON u.telegram_id = ts.user_id
WHERE u.id = ?
GROUP BY u.id, u.first_name, u.last_name, u.username, u.status, ts.status, ts.created_at;
  `;

  db.query(query, [candidateId], (err, results) => {
    if (err) {
      console.error("Ошибка при выполнении запроса:", err);
      return res.status(500).json({ message: 'Ошибка сервера' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'Кандидат не найден' });
    }

    const candidate = results[0];

    const resumePaths = candidate.filePaths || [];
    const testAnswers = candidate.testAnswers || [];

    const response = {
      id: candidate.id,
      name: candidate.name,
      username: candidate.username,
      testStatus: candidate.testStatus,
      adminStatus: candidate.adminStatus,
      testDate: candidate.testDate,
      resumeUrl: resumePaths.length > 0 ? `https://mansurov.tj/bots/sardorLLC/resumes/${resumePaths[0]}` : '',
      testAnswers: testAnswers
    };

    res.json(response);
  });
});

//   for mini test start
app.get('/api/questions', (req, res) => {
  const query = 'SELECT * FROM questions';
  db.query(query, [], (err, results) => {
    if (err) {
      console.error('Ошибка при получении вопросов:', err);
      return res.status(500).json({ error: 'Ошибка сервера' });
    }
    res.json(results);
  });
});

app.post('/api/questions', (req, res) => {
  const { question } = req.body;
  const query = 'INSERT INTO questions (question_text) VALUES (?)';
  db.query(query, [question], (err, result) => {
    if (err) {
      console.error('Ошибка при добавлении вопроса:', err);
      return res.status(500).json({ error: 'Ошибка сервера' });
    }
    res.status(201).json({ id: result.insertId, question });
  });
});

app.put('/api/questions/:id', (req, res) => {
  const { id } = req.params;
  const { question } = req.body;
  const query = 'UPDATE questions SET question_text = ? WHERE id = ?';
  db.query(query, [question, id], (err, result) => {
    if (err) {
      console.error('Ошибка при обновлении вопроса:', err);
      return res.status(500).json({ error: 'Ошибка сервера' });
    }
    res.json({ id: parseInt(id), question });
  });
});

app.delete('/api/questions/:id', (req, res) => {
  const { id } = req.params;
  const query = 'DELETE FROM questions WHERE id = ?';
  db.query(query, [id], (err, result) => {
    if (err) {
      console.error('Ошибка при удалении вопроса:', err);
      return res.status(500).json({ error: 'Ошибка сервера' });
    }
    res.json({ message: 'Вопрос удалён', id: parseInt(id) });
  });
});
// for mini test end

// FAQ start
app.get('/api/faqs', (req, res) => {
  const sql = 'SELECT * FROM faq ORDER BY id';
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post('/api/faqs', (req, res) => {
  const { question, answer } = req.body;

  const sql = 'INSERT INTO faq (question, answer) VALUES (?, ?)';
  db.query(sql, [question, answer], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: result.insertId, question, answer });
  });
});

app.put('/api/faqs/:id', (req, res) => {
  const { id } = req.params;
  const { question, answer } = req.body;
  const sql = 'UPDATE faq SET question = ?, answer = ? WHERE id = ?';
  db.query(sql, [question, answer, id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'FAQ not found' });
    }
    res.json({ id, question, answer });
  });
});

app.delete('/api/faqs/:id', (req, res) => {
  const { id } = req.params;
  const sql = 'DELETE FROM faq WHERE id = ?';
  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'FAQ not found' });
    }
    res.status(204).end();
  });
});

// FAQ end

// Update admin status for a candidate AND insert/update interview status
app.post('/updateAdminStatus', (req, res) => {
  const { userId, adminStatus } = req.body;

  if (!userId || !adminStatus) {
    return res.status(400).json({ error: 'User ID and admin status are required' });
  }

  // SQL to update user status
  const updateUserSql = 'UPDATE candidates SET status = ? WHERE id = ?';

  db.query(updateUserSql, [adminStatus, userId], (err, results) => {
    if (err) {
      console.error('Database error while updating user:', err);
      return res.status(500).json({ error: 'Database error while updating user status' });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    let interviewStatus = null;
    if (adminStatus === 'interview') {
      interviewStatus = 'interview';
    } else if (adminStatus === 'accepted') {
      interviewStatus = 'accepted';
    } else if (adminStatus === 'rejected') {
      interviewStatus = 'rejected';
    }

    if (!interviewStatus) {
      return res.status(400).json({ error: 'Invalid admin status' });
    }

    // Insert or update interview_statuses table
    const interviewDate = new Date(); // Now
    const insertOrUpdateSql = `
      INSERT INTO interview_statuses (candidate_id, interview_status, interview_date, notification_sent)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        interview_status = VALUES(interview_status),
        interview_date = VALUES(interview_date),
        notification_sent = 0
    `;

    db.query(insertOrUpdateSql, [userId, interviewStatus, interviewDate, 0], (err2) => {
      if (err2) {
        console.error('Database error while updating interview status:', err2);
        return res.status(500).json({ error: 'Database error while updating interview status' });
      }

      res.status(200).json({ message: 'Admin and interview status updated successfully' });
    });
  });
});

// Update user status end

// notifications start
app.post('/api/notifications/send', async (req, res) => {
  const { userIds, message } = req.body;

  if (!Array.isArray(userIds) || !message) return res.status(400).json({ error: 'Invalid input' });

  const values = userIds.map(id => [id, message]);
  const sql = 'INSERT INTO notifications (user_id, message) VALUES ?';

  db.query(sql, [values], (err, result) => {
    if (err) {
      console.error('DB error:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    res.json({ success: true });
  });
});
// notifications end

// Route for admin login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' });
  }

  // Check if the admin exists in the database
  db.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
    if (err) {
      console.error("Database Error:", err);
      return res.status(500).json({ message: 'Server error' });
    }

    if (results.length === 0) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }

    const admin = results[0];

    // Compare the hashed password with the input
    bcrypt.compare(password, admin.password, (err, isMatch) => {
      if (err) {
        console.error("Error comparing passwords:", err);
        return res.status(500).json({ message: 'Server error' });
      }

      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid username or password' });
      }

      // Generate a JWT token for the admin
      const token = jwt.sign({ adminId: admin.id, username: admin.username, role: admin.role, userId: admin.id }, 'secretKey', {
        expiresIn: '1h',
      });

      res.status(200).json({ message: 'Login successful', token, role: admin.role, userId: admin.id });
    });
  });
});

// survey start
// 1. Create a new question
app.post('/surveyQuestions', (req, res) => {
  const { questionText } = req.body;

  if (!questionText || questionText.trim() === '') {
    return res.status(400).json({ error: 'Question is required' });
  }

  const query = 'INSERT INTO surveyQuestions (questionText) VALUES (?)';
  db.query(query, [questionText], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Error adding question' });
    }
    res.status(201).json({ message: 'Question added successfully', id: result.insertId });
  });
});

// 2. Get all questions
app.get('/surveyQuestions', (req, res) => {
  const query = 'SELECT * FROM surveyQuestions';
  db.query(query, (err, results) => {
    if (err) {
      console.error(err); // Log the error for debugging
      return res.status(500).json({ error: 'Error fetching questions' });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: 'No questions found' });
    }
    res.status(200).json(results);
  });
});

// 4. Update question by ID
app.put('/surveyQuestions/:id', (req, res) => {
  const questionId = req.params.id;
  const { questionText } = req.body;

  if (!questionText || questionText.trim() === '') {
    return res.status(400).json({ error: 'Question text is required' });
  }

  const query = 'UPDATE surveyQuestions SET questionText = ? WHERE id = ?';
  db.query(query, [questionText, questionId], (err, result) => {
    if (err) {
      console.error(err); // Log the error for debugging
      return res.status(500).json({ error: 'Error updating question' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }
    res.status(200).json({ message: 'Question updated successfully' });
  });
});

// 5. Delete question by ID
app.delete('/surveyQuestions/:id', (req, res) => {
  const questionId = req.params.id;

  const query = 'DELETE FROM surveyQuestions WHERE id = ?';
  db.query(query, [questionId], (err, result) => {
    if (err) {
      console.error(err); // Log the error for debugging
      return res.status(500).json({ error: 'Error deleting question' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Question not found' });
    }
    res.status(200).json({ message: 'Question deleted successfully' });
  });
});

app.get('/surveyResponses', (req, res) => {
  const query = `
 SELECT sr.id, sr.userId, sr.questionId, sr.response, sr.type, sr.date, sq.questionText 
 FROM surveyResponses sr LEFT JOIN surveyQuestions sq ON sr.questionId = sq.id ORDER BY sr.date DESC
  `;

  db.query(query, (err, result) => {
    if (err) {
      console.error('Ошибка при получении отзывов:', err);
      return res.status(500).json({ message: 'Ошибка при получении данных' });
    }
    res.json(result);
  });
});

app.post('/survey', (req, res) => {
  const sql = 'INSERT INTO survey (date, isSent) VALUES (NOW(), 0)';
  db.query(sql, (err, result) => {
    if (err) {
      console.error('Error inserting survey:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    res.status(201).json({ message: 'Survey created', surveyId: result.insertId });
  });
});
// survey end

// Tasks Endpoints start
// Create Task
app.post('/tasks', (req, res) => {
  const { title, deadline } = req.body;
  const sql = 'INSERT INTO tasks (title, deadline) VALUES (?, ?)';
  db.query(sql, [title, deadline], (err, result) => {
    if (err) {
      console.error('Error inserting task:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    const newTask = { id: result.insertId, title, deadline };
    res.status(201).json(newTask); // Return the full task object
  });
});


// Get All Tasks
app.get('/tasks', (req, res) => {
  const sql = 'SELECT id, title, DATE_FORMAT(deadline, "%Y-%m-%d") as deadline FROM tasks';
  db.query(sql, (err, result) => {
    if (err) {
      console.error('Error fetching tasks:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    res.status(200).json(result);
  });
});

// Update Task
app.put('/tasks/:id', (req, res) => {
  const { title, deadline } = req.body;
  const sql = 'UPDATE tasks SET title = ?, deadline = ? WHERE id = ?';
  db.query(sql, [title, deadline, req.params.id], (err, result) => {
    if (err) {
      console.error('Error updating task:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    res.status(200).json({ message: 'Task updated' });
  });
});

// Delete Task
app.delete('/tasks/:id', (req, res) => {
  const sql = 'DELETE FROM tasks WHERE id = ?';
  db.query(sql, [req.params.id], (err, result) => {
    if (err) {
      console.error('Error deleting task:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    res.status(200).json({ message: 'Task deleted' });
  });
});

// Назначить задачу кандидатам
app.post('/assign-task', (req, res) => {
  const assignments = req.body; // Expecting an array of { taskId, candidateId }

  if (!Array.isArray(assignments) || assignments.length === 0) {
    return res.status(400).json({ message: 'Assignments array is required' });
  }

  const sql = 'INSERT INTO assigned_tasks (user_id, task_id) VALUES ?';
  const values = assignments.map(({ candidateId, taskId }) => [candidateId, taskId]);

  db.query(sql, [values], (err, result) => {
    if (err) {
      console.error('Error assigning task to candidates:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    res.status(201).json({ message: 'Task assigned successfully', assignedCount: result.affectedRows });
  });
});

app.get('/assigned-tasks', (req, res) => {
  const sql = `
    SELECT ast.id, ast.user_id AS candidate_id, ast.task_id, t.title AS task_title, u.first_name, u.last_name
    FROM assigned_tasks ast
    JOIN tasks t ON ast.task_id = t.id
    JOIN candidates u ON ast.user_id = u.id
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching assigned tasks:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    res.status(200).json(results);
  });
});

app.get("/candidateTasks/:id", (req, res) => {
  const userId = req.params.id;

  // Step 1: Get all tasks assigned to the user
  const sql = `
    SELECT t.id, t.title, t.deadline, ast.status 
    FROM assigned_tasks ast
    JOIN tasks t ON t.id = ast.task_id
    WHERE ast.user_id = ?
  `;

  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error("Error fetching candidate tasks:", err);
      return res.status(500).json({ message: "Server error" });
    }

    const currentDate = new Date();

    // Step 2: Update task statuses based on deadline
    const updatedResults = results.map(task => {
      const deadlineDate = new Date(task.deadline);

      // If the task is not done and the deadline has passed, set the status to "failed"
      if (task.status !== 'done' && deadlineDate < currentDate) {
        return { ...task, status: 'failed' };
      }

      return { ...task };
    });

    // Step 3: Calculate percentage of tasks completed
    const totalTasks = updatedResults.length;
    const completedTasks = updatedResults.filter(task => task.status === 'done').length;
    const completionPercentage = (completedTasks / totalTasks) * 100;

    // Step 4: Add percentage to the response
    res.json({
      tasks: updatedResults,
      completionPercentage: completionPercentage.toFixed(2)
    });
  });
});
// Tasks Endpoints end 

// Middleware для проверки роли админа
const checkAdminRole = (req, res, next) => {
  const role = req.headers['role'];
  if (role !== 'admin') {
    return res.status(403).json({ message: 'Access denied. Admin role required.' });
  }
  next();
};

// Start mentors
app.post('/mentors', checkAdminRole, (req, res) => {
  const { username, password, role } = req.body;
  const saltRounds = 10;

  if (!username || !password || !role) {
    return res.status(400).json({ error: 'Username, password, and role are required' });
  }

  // Validate role
  const validRoles = ['admin', 'op', 'line'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Must be one of: admin, op, line' });
  }

  bcrypt.hash(password, saltRounds, (err, hashedPassword) => {
    if (err) {
      console.error('Hashing error:', err);
      return res.status(500).json({ message: 'Password encryption failed' });
    }

    const sql = 'INSERT INTO users (username, password, role) VALUES (?, ?, ?)';
    db.query(sql, [username, hashedPassword, role], (err, result) => {
      if (err) {
        console.error('Database insert error:', err);
        return res.status(500).json({ message: 'Database error' });
      }

      res.status(201).json({ id: result.insertId, username, role });
    });
  });
});

// Обновление пользователя
app.put('/mentors/:id', checkAdminRole, (req, res) => {
  const { id } = req.params;
  const { username, password, role } = req.body;

  // Validate role
  const validRoles = ['admin', 'op', 'line'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Must be one of: admin, op, line' });
  }

  // Если пароль предоставлен, обновляем его вместе с другими данными
  if (password) {
    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) {
        console.error('Hashing error:', err);
        return res.status(500).json({ message: 'Password encryption failed' });
      }

      const sql = 'UPDATE users SET username = ?, password = ?, role = ? WHERE id = ?';
      db.query(sql, [username, hashedPassword, role, id], (err, result) => {
        if (err) {
          console.error('Update error:', err);
          return res.status(500).json({ message: 'Database error' });
        }
        if (result.affectedRows === 0) {
          return res.status(404).json({ message: 'User not found' });
        }
        res.json({ message: 'User updated successfully', id, username, role });
      });
    });
  } else {
    // Если пароль не предоставлен, обновляем только имя пользователя и роль
    const sql = 'UPDATE users SET username = ?, role = ? WHERE id = ?';
    db.query(sql, [username, role, id], (err, result) => {
      if (err) {
        console.error('Update error:', err);
        return res.status(500).json({ message: 'Database error' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json({ message: 'User updated successfully', id, username, role });
    });
  }
});

// Удаление пользователя
app.delete('/mentors/:id', checkAdminRole, (req, res) => {
  const { id } = req.params;
  
  const sql = 'DELETE FROM users WHERE id = ?';
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error('Delete error:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  });
});

app.get('/mentors', checkAdminRole, (req, res) => {
  const sql = 'SELECT id, username, role FROM users ORDER BY id DESC';

  db.query(sql, (err, results) => {
    if (err) {
      console.error('Fetch error:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    res.status(200).json(results);
  });
});

// End mentors

app.get('/adaptation-plan', (req, res) => {
  const role = req.headers['role'];
  const userId = req.headers['userid'];

  if (role === 'admin') {
    const sql = `
      SELECT adaptation_plans.*, users.username 
      FROM adaptation_plans 
      JOIN users ON users.id = adaptation_plans.user_id
    `;
    db.query(sql, (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Database error' });
      }
      res.json(results);
    });
  } else {
    const sql = 'SELECT * FROM adaptation_plans WHERE user_id = ?';
    db.query(sql, [userId], (err, results) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ message: 'Database error' });
      }
      res.json(results);
    });
  }
});

// End mentors

// Adapattion Plan start
// Get plan for the logged-in mentor
app.get('/adaptation-plan', async (req, res) => {
  const role = req.headers['role'];
  const userId = req.headers['userid']; // Теперь берём userId из заголовков

  if (role === 'admin') {
    const [rows] = db.query(`
      SELECT adaptation_plans.*, users.username 
      FROM adaptation_plans 
      JOIN users ON users.id = adaptation_plans.mentor_id
    `);
    return res.json(rows);
  } else {
    const [rows] = db.query(
      'SELECT * FROM adaptation_plans WHERE mentor_id = ?',
      [userId]
    );
    return res.json(rows);
  }
});


// Add a new plan (admin only)
app.post('/adaptation-plan', (req, res) => {
  const { mentor_id, link, role } = req.body;

  if (role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const sql = 'INSERT INTO adaptation_plans (user_id, link) VALUES (?, ?)';
  db.query(sql, [mentor_id, link], (err, result) => {
    if (err) {
      console.error('Insert error:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    res.status(201).json({ message: 'Plan added' });
  });
});

// PUT: Редактирование
app.put('/adaptation-plan/:id', (req, res) => {
  const { mentor_id, link, role } = req.body;
  const planId = req.params.id;

  if (role !== 'admin') return res.status(403).json({ message: 'Forbidden' });

  const sql = 'UPDATE adaptation_plans SET user_id = ?, link = ? WHERE id = ?';
  db.query(sql, [mentor_id, link, planId], (err) => {
    if (err) {
      console.error('Update error:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    res.json({ message: 'Plan updated' });
  });
});

// DELETE: Удаление
app.delete('/adaptation-plan/:id', (req, res) => {
  const { role } = req.headers;
  const planId = req.params.id;

  if (role !== 'admin') return res.status(403).json({ message: 'Forbidden' });

  const sql = 'DELETE FROM adaptation_plans WHERE id = ?';
  db.query(sql, [planId], (err) => {
    if (err) {
      console.error('Delete error:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    res.json({ message: 'Plan deleted' });
  });
});

// Adaptation Plan end

// Adaptation Plans Routes
app.get('/api/users/mentors', (req, res) => {
  const sql = 'SELECT id, username FROM users WHERE role = "op"';
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching mentors:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    res.json(results);
  });
});

app.get('/api/candidates/trainees', (req, res) => {
  const sql = `
    SELECT 
      id,
      CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')) AS username
    FROM candidates 
    WHERE status = 'accepted'
  `;
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Error fetching trainees:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    res.json(results);
  });
});

app.get('/api/staff-adaptation-plans', (req, res) => {
  const role = req.headers['role'];
  const userId = req.headers['userid'];
  const planType = req.query.type || 'op'; // Default to 'op' if not specified

  let sql = `
    SELECT 
      p.*,
      u.username as mentor_username,
      CONCAT(COALESCE(c.first_name, ''), ' ', COALESCE(c.last_name, '')) as trainee_username
    FROM staff_adaptation_plans p
    JOIN users u ON p.mentor_id = u.id
    JOIN candidates c ON p.trainee_id = c.id
    WHERE p.plan_type = ?
  `;

  // If not admin, only show plans where user is mentor
  if (role !== 'admin') {
    sql += ' AND p.mentor_id = ?';
  }
  
  sql += ' ORDER BY p.created_at DESC';
  
  const queryParams = role === 'admin' ? [planType] : [planType, userId];
  
  db.query(sql, queryParams, (err, results) => {
    if (err) {
      console.error('Error fetching plans:', err);
      return res.status(500).json({ message: 'Server error' });
    }

    const plans = results.map(plan => ({
      id: plan.id,
      mentor_id: plan.mentor_id,
      trainee_id: plan.trainee_id,
      start_date: plan.start_date,
      end_date: plan.end_date,
      mentor: {
        id: plan.mentor_id,
        username: plan.mentor_username
      },
      trainee: {
        id: plan.trainee_id,
        username: plan.trainee_username
      }
    }));

    res.json(plans);
  });
});

app.post('/api/staff-adaptation-plans', (req, res) => {
  const { mentor_id, trainee_id, start_date, end_date, plan_type = 'op' } = req.body;

  const sql = `
    INSERT INTO staff_adaptation_plans 
    (mentor_id, trainee_id, start_date, end_date, plan_type) 
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(sql, [mentor_id, trainee_id, start_date, end_date, plan_type], (err, result) => {
    if (err) {
      console.error('Error creating plan:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    res.status(201).json({ id: result.insertId });
  });
});

app.put('/api/staff-adaptation-plans/:id', (req, res) => {
  const { id } = req.params;
  const { mentor_id, trainee_id, start_date, end_date } = req.body;

  const sql = `
    UPDATE staff_adaptation_plans 
    SET mentor_id = ?, 
        trainee_id = ?, 
        start_date = ?,
        end_date = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `;

  db.query(sql, [mentor_id, trainee_id, start_date, end_date, id], (err, result) => {
    if (err) {
      console.error('Error updating plan:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Plan not found' });
    }
    res.json({ message: 'Plan updated successfully' });
  });
});

app.delete('/api/staff-adaptation-plans/:id', (req, res) => {
  const { id } = req.params;

  const sql = 'DELETE FROM staff_adaptation_plans WHERE id = ?';
  
  db.query(sql, [id], (err, result) => {
    if (err) {
      console.error('Error deleting plan:', err);
      return res.status(500).json({ message: 'Server error' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Plan not found' });
    }
    res.json({ message: 'Plan deleted successfully' });
  });
});

// Admin Adaptation Plan Routes
app.get('/adaptation-plan/admin', (req, res) => {
  const role = req.headers['role'];
  const userId = req.headers['userid'];

  if (role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const sql = `
    SELECT adaptation_plans.*, users.username 
    FROM adaptation_plans 
    JOIN users ON users.id = adaptation_plans.user_id
  `;
  
  db.query(sql, (err, results) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ message: 'Database error' });
    }
    res.json(results);
  });
});

app.post('/adaptation-plan/admin', (req, res) => {
  const { mentor_id, link, role } = req.body;

  if (role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const sql = 'INSERT INTO adaptation_plans (user_id, link) VALUES (?, ?)';
  db.query(sql, [mentor_id, link], (err, result) => {
    if (err) {
      console.error('Insert error:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    res.status(201).json({ message: 'Plan added' });
  });
});

app.put('/adaptation-plan/admin/:id', (req, res) => {
  const { mentor_id, link, role } = req.body;
  const planId = req.params.id;

  if (role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const sql = 'UPDATE adaptation_plans SET user_id = ?, link = ? WHERE id = ?';
  db.query(sql, [mentor_id, link, planId], (err) => {
    if (err) {
      console.error('Update error:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    res.json({ message: 'Plan updated' });
  });
});

app.delete('/adaptation-plan/admin/:id', (req, res) => {
  const { role } = req.headers;
  const planId = req.params.id;

  if (role !== 'admin') {
    return res.status(403).json({ message: 'Forbidden' });
  }

  const sql = 'DELETE FROM adaptation_plans WHERE id = ?';
  db.query(sql, [planId], (err) => {
    if (err) {
      console.error('Delete error:', err);
      return res.status(500).json({ message: 'Database error' });
    }

    res.json({ message: 'Plan deleted' });
  });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
