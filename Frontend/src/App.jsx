import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login3d from './Login3d';
import Register from './Register';
import HomePage from './HomePage';
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login3d />} />
        <Route path="/login" element={<Login3d />} />
        <Route path="/register" element={<Register />} />
        <Route path="/homepage" element={<HomePage />} />
      </Routes>
    </Router>
  )
}

export default App
