// Shared notice constants (kept out of the components to avoid circular imports).
export const AUDIENCE_LABEL = {
  ALL: 'সব',
  ADMIN: 'অ্যাডমিন',
  DEPARTMENT_ADMIN: 'ডিপ-অ্যাডমিন',
  TEACHER: 'শিক্ষক',
  STUDENT: 'শিক্ষার্থী',
};

export const AUDIENCE_STYLE = {
  ALL: 'bg-slate-100 text-slate-600',
  ADMIN: 'bg-rose-100 text-rose-600',
  DEPARTMENT_ADMIN: 'bg-purple-100 text-purple-600',
  TEACHER: 'bg-indigo-100 text-indigo-600',
  STUDENT: 'bg-emerald-100 text-emerald-600',
};

// Where each role's notice page lives.
export const noticesPath = (role) =>
  role === 'admin' ? '/admin/notices'
    : role === 'departmentAdmin' ? '/departmentAdmin/notices'
      : role === 'teacher' ? '/teacher/notices'
        : '/student/notices';
