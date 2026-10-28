FROM ghcr.io/tidywf/nemo-image:0.1.2

# use pip from the nemo conda env
RUN pip install awslambdaric python-ulid

WORKDIR /var/task
COPY handler.py ./

ENTRYPOINT ["python3", "-m", "awslambdaric"]
CMD ["handler.handler"]
