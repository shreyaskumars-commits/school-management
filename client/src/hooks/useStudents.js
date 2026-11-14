import { useCallback, useEffect, useState } from "react";
import {
  createStudent,
  deleteStudent,
  getStudents,
  updateStudent,
} from "../api.js";
import useDebounce from "./useDebounce.js";

const LIMIT = 5;

export default function useStudents() {
  const [students, setStudents] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [department, setDepartment] = useState("");
  const [message, setMessage] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const wanted = useDebounce(department.trim());
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  useEffect(() => {
    let ignore = false;
    getStudents({ page, limit: LIMIT, department: wanted })
      .then((result) => {
        if (ignore) return;
        const pages = Math.max(1, Math.ceil(result.total / LIMIT));
        if (page > pages) {
          setPage(pages);
          return;
        }
        setStudents(result.data);
        setTotal(result.total);
      })
      .catch((err) => {
        if (!ignore) setMessage({ text: err.message, isError: true });
      });
    return () => {
      ignore = true;
    };
  }, [page, wanted, reloadKey]);

  const changeDepartment = useCallback((value) => {
    setDepartment(value);
    setPage(1);
  }, []);

  async function run(action, successText) {
    try {
      await action();
      setMessage({ text: successText, isError: false });
      setReloadKey((k) => k + 1);
      return true;
    } catch (err) {
      setMessage({ text: err.message, isError: true });
      return false;
    }
  }

  return {
    students,
    total,
    page,
    totalPages,
    department,
    message,
    setPage,
    changeDepartment,
    clearMessage: () => setMessage(null),
    add: (student) => run(() => createStudent(student), "Student added"),
    update: (id, changes) =>
      run(() => updateStudent(id, changes), "Student updated"),
    remove: (student) =>
      run(() => deleteStudent(student.id), `Deleted ${student.name}`),
  };
}
