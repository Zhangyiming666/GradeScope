import { Navigate, useParams } from 'react-router-dom'

export function ScoreRedirect() {
  const { courseId } = useParams()
  return <Navigate to={courseId ? `/courses/${courseId}` : '/courses'} replace />
}
