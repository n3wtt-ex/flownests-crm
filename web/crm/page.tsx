export default function CRMTop() {
  if (typeof window !== 'undefined') {
    window.location.replace('/app/crm');
  }
  return null;
}
