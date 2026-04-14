import server
print('Inicializando/actualizando la base de datos...')
server.ensure_db()
print('Hecho.')
