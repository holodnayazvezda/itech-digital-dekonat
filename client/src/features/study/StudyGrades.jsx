import { Check, ChevronRight, X } from "lucide-react";
const passing = new Set(["Отлично", "Хорошо", "Удовлетворительно", "Зачёт", "Зачтено"]);
const failing = new Set(["Неудовлетворительно", "Незачёт", "Не зачтено", "Неуд"]);
function gradeResult(grade) {
  if (passing.has(grade)) return "passed";
  if (failing.has(grade)) return "failed";
  return "pending";
}
const resultIcons = {
  passed: Check,
  failed: X
};
export default function StudyGrades({
  grades,
  expandedCourse,
  onSelect
}) {
  const closedCount = grades.filter(course => passing.has(course.grade)).length;
  const completed = grades.length ? Math.round(closedCount / grades.length * 100) : 0;
  return <div className="content study-content">
    <div className="study-summary">
      <div><small>Успеваемость</small><h2>Прогресс обучения</h2><p>{closedCount} из {grades.length} дисциплин закрыто</p></div>
      <div className="study-progress-ring" role="progressbar" aria-label="Закрыто дисциплин" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={100}>
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle className="study-ring-track" cx="50" cy="50" r="42" />
          <circle className="study-ring-value" cx="50" cy="50" r="42" pathLength="100" strokeDasharray={`${completed} 100`} />
        </svg>
        <strong>{completed}<span>%</span></strong>
      </div>
    </div>
    <div className="study-section-heading"><h2>Дисциплины</h2><small>{grades.length} в зачётке</small></div>
    <div className="study-course-list">
      {grades.map(({
        grade,
        name,
        summary,
        points
      }, index) => {
        const details = points.length > 0;
        const expanded = details && name === expandedCourse;
        const detailsId = "study-marks-" + index;
        const result = gradeResult(grade);
        const StatusIcon = resultIcons[result];
        const maximum = points.reduce((sum, point) => sum + point[2], 0);
        const total = points.reduce((sum, point) => sum + point[1], 0);
        const Row = details ? "button" : "div";
        return <div className="study-course-item" key={name}>
          <Row className="study-course" onClick={details ? () => onSelect(name) : undefined} aria-expanded={details ? expanded : undefined} aria-controls={expanded ? detailsId : undefined}>
            <span><b>{name}</b><small>{summary}</small></span>
            <div className="study-result" data-result={result}>
              {maximum > 0 && <strong className="study-score">{Math.round(total / maximum * 100)}%</strong>}
              <span className="study-status-dot" aria-hidden="true">{StatusIcon && <StatusIcon size={12} strokeWidth={2.5} />}</span>
              <span>{grade || "Нет оценки"}</span>
            </div>
            {details ? <ChevronRight size={18} strokeWidth={1.7} aria-hidden="true" /> : <span className="study-course-spacer" />}
          </Row>
          {expanded && <section className="study-marks" id={detailsId} aria-label={"Контрольные точки: " + name}>
            <div className="study-marks-heading"><span>Контрольные точки</span><strong>{total} / {maximum} баллов</strong></div>
            <dl>{points.map(([point, earned, limit]) => <div className="study-mark-row" key={point}>
              <dt>{point}</dt><dd>{earned}<span> / {limit}</span></dd>
              <progress aria-label={point} value={earned} max={limit || 1} />
            </div>)}</dl>
          </section>}
        </div>;
      })}
    </div>
  </div>;
}
