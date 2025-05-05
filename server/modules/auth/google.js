import express from 'express';
import admin from '../../shared/firebaseAdmin.js';

const router = express.Router();

router.post('/google', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).send('Token ausente');

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    res.json({ uid: decoded.uid, email: decoded.email });
  } catch (err) {
    res.status(401).send('Token inválido');
  }
});

export default router;