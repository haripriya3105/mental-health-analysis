import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

const API_URL = import.meta.env.VITE_API_URL || ''
const DISCLAIMER = 'Assessment results are not a medical diagnosis. They are intended only to help users understand general wellness patterns. Please consult a qualified mental health professional for clinical concerns.'
const OPTIONS = [['0', 'Not at all'], ['1', 'Several days'], ['2', 'More than half the days'], ['3', 'Nearly every day']]

async function api(path, token, options = {}) {
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers } })
  const body = await response.json()
  if (!response.ok) throw new Error(body.detail || 'Unable to complete this request.')
  return body
}

function History({ history }) {
  if (!history.length) return <section className="panel"><h2>Assessment history</h2><p className="empty-copy">No previous assessments yet.</p></section>
  const chartData = [...history].reverse().map((item) => ({ date: new Date(item.created_at).toLocaleDateString(), score: item.total_score }))
  return <section className="panel assessment-history"><h2>Assessment history</h2>{history.length > 1 && <div className="score-chart"><ResponsiveContainer width="100%" height={220}><LineChart data={chartData}><XAxis dataKey="date" /><YAxis allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="score" stroke="#087b70" strokeWidth={3} dot={{ r: 4 }} /></LineChart></ResponsiveContainer></div>}<div className="history-list">{history.map((item) => <article key={item.id}><span>{new Date(item.created_at).toLocaleDateString()}</span><strong>Score {item.total_score}</strong><em>{item.result_category}</em></article>)}</div></section>
}

export default function AssessmentPage() {
  const token = sessionStorage.getItem('access_token'); const [questions, setQuestions] = useState([]); const [answers, setAnswers] = useState({}); const [index, setIndex] = useState(0); const [history, setHistory] = useState([]); const [result, setResult] = useState(null); const [loading, setLoading] = useState(true); const [submitting, setSubmitting] = useState(false); const [error, setError] = useState('')
  const load = async () => { setLoading(true); setError(''); try { const [questionData, historyData] = await Promise.all([api('/api/assessment/questions', token), api('/api/assessment/history', token)]); setQuestions(questionData); setHistory(historyData) } catch (err) { setError(err.message) } finally { setLoading(false) } }
  useEffect(() => { load() }, [])
  if (loading) return <section className="panel loading-panel">Loading your assessment…</section>
  if (error && !questions.length) return <section className="panel"><div className="error" role="alert">{error}</div><button className="secondary-button" onClick={load}>Try again</button></section>
  if (result) return <><section className="result-card"><p className="eyebrow">Assessment complete</p><h1>{result.result_category}</h1><div className="score-badge">{result.total_score}</div><p>{result.guidance}</p>{result.result_category === 'HIGHER CONCERN' && <p className="support-message">Consider reaching out to a qualified mental health professional for support.</p>}<p className="medical-note">AI and assessment results are not a medical diagnosis.</p><button className="secondary-button" onClick={() => { setResult(null); setAnswers({}); setIndex(0) }}>Take another assessment</button></section><History history={history} /></>
  const question = questions[index]; const selected = answers[question?.id]; const progress = questions.length ? ((index + 1) / questions.length) * 100 : 0
  const next = () => { if (selected === undefined) { setError('Choose one response before continuing.'); return } setError(''); setIndex((current) => Math.min(current + 1, questions.length - 1)) }
  const submit = async () => { if (selected === undefined) { setError('Choose one response before submitting.'); return } if (Object.keys(answers).length !== questions.length) { setError('Please answer every question before submitting.'); return } setSubmitting(true); setError(''); try { const newResult = await api('/api/assessment/submit', token, { method: 'POST', body: JSON.stringify({ answers: questions.map((item) => ({ question_id: item.id, answer_value: answers[item.id] })) }) }); setResult(newResult); setHistory((items) => [newResult, ...items]) } catch (err) { setError(err.message) } finally { setSubmitting(false) } }
  return <><section className="assessment-intro"><p className="eyebrow">Wellness check-in</p><h1>Understand your current wellness patterns</h1><p>This short self-assessment is a private opportunity to reflect on the past two weeks.</p><aside className="safety-note"><strong>Please note:</strong> {DISCLAIMER}</aside></section><section className="panel assessment-card"><div className="progress-copy"><span>Question {index + 1} of {questions.length}</span><span>{Math.round(progress)}%</span></div><div className="progress-bar"><i style={{ width: `${progress}%` }} /></div><p className="question-category">{question.category}</p><h2>{question.question_text}</h2><div className="answer-options">{OPTIONS.map(([value, label]) => <label className={selected === Number(value) ? 'answer-option selected' : 'answer-option'} key={value}><input type="radio" name={`question-${question.id}`} checked={selected === Number(value)} onChange={() => { setAnswers({ ...answers, [question.id]: Number(value) }); setError('') }} />{label}</label>)}</div>{error && <div className="error" role="alert">{error}</div>}<div className="assessment-controls"><button className="secondary-button" disabled={index === 0 || submitting} onClick={() => { setError(''); setIndex(index - 1) }}>Previous</button>{index < questions.length - 1 ? <button className="primary-button compact-button" onClick={next}>Next</button> : <button className="primary-button compact-button" disabled={submitting} onClick={submit}>{submitting ? 'Saving assessment…' : 'Submit assessment'}</button>}</div></section><History history={history} /><p className="medical-note">AI and assessment results are not a medical diagnosis.</p></>
}
