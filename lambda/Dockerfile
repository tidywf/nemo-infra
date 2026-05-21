FROM ghcr.io/tidywf/tidywigits:0.0.7.9003

# use pip/py from tidywigits conda env
RUN pip install awslambdaric awscli

WORKDIR /var/task
COPY handler.py sync.py ./

ENTRYPOINT ["python3", "-m", "awslambdaric"]
CMD ["handler.handler"]
