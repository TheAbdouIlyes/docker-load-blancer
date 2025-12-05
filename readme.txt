CONTAINER ID   IMAGE                  COMMAND                  CREATED          STATUS          PORTS                                         NAMES
7c304eb052b3   asr_project-backend2   "docker-entrypoint.s…"   49 minutes ago   Up 49 minutes   4000/tcp                                      backend2
3a152a64eab1   asr_project-backend    "docker-entrypoint.s…"   52 minutes ago   Up 52 minutes   0.0.0.0:2833->4000/tcp, [::]:2833->4000/tcp   backend
54beeb12a991   mysql:8                "docker-entrypoint.s…"   52 minutes ago   Up 52 minutes   3306/tcp, 33060/tcp                           db2
b0bc36db093f   mysql:8                "docker-entrypoint.s…"   52 minutes ago   Up 52 minutes   3306/tcp, 33060/tcp                           db1