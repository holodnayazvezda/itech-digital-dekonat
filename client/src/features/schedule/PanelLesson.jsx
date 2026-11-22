import LessonActions from "./LessonActions.jsx";
import LessonDetails from "./LessonDetails.jsx";
import { Fragment } from "react";
import { useSignals } from "@preact/signals-react/runtime";
import { useCabinet } from "../../shared/state/CabinetContext.jsx";
export default function PanelLesson() {
  useSignals();
  const {
    role,
    open,
    goPage,
    busy,
    say,
    perform,
    lesson,
    instructor,
    openLessonPage
  } = useCabinet();
  return <Fragment>
                    <LessonDetails lesson={lesson.value} instructor={instructor.value} onRoom={() => open("room")} onRoute={() => openLessonPage("navigator", lesson.value.room, {
      date: lesson.value.date,
      fromEntrance: true
    })} onInstructor={instructor.value ? () => openLessonPage("person", instructor.value.id) : undefined} onInstructorSchedule={() => open("teacher")} onGroup={role.value === "teacher" ? () => goPage("directory", lesson.value.group) : undefined}>
                    <LessonActions lesson={lesson.value} key={lesson.value.id} busy={busy.value} onPublish={async (action, data) => {
        const result = await perform("teaching/lesson/" + action, data);
        if (result) {
          lesson.value = result.lesson;
          say(action === "homework" ? "Задание отправлено группе" : action === "cancel" ? "Отмена опубликована" : "Перенос опубликован");
        }
        return result;
      }} />
                    </LessonDetails>
                  </Fragment>;
}
